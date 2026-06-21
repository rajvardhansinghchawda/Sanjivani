
new_class = """
@method_decorator(csrf_exempt, name='dispatch')
class AgentProcessWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, session_id):
        user_speech = request.POST.get('SpeechResult', '').strip()
        confidence  = float(request.POST.get('Confidence', 0))
        is_retry    = request.GET.get('retry') == '1'

        try:
            session = CallSession.objects.get(id=session_id)
        except CallSession.DoesNotExist:
            from twilio.twiml.voice_response import VoiceResponse
            r = VoiceResponse()
            r.say('Session expired. Goodbye.')
            r.hangup()
            return HttpResponse(str(r), content_type='text/xml')

        language = session.language or 'en'
        meta     = session.meta_data or {}

        # no speech
        if not user_speech or confidence < 0.3:
            if is_retry:
                twiml = build_agent_end_twiml(language)
            else:
                prompt = ('Main aapki awaaz nahi sun saka. Kripya dobara bolein.'
                          if language == 'hi' else
                          "I didn't catch that. Please speak clearly.")
                twiml = build_agent_listen_twiml(session_id, prompt, language)
            return HttpResponse(twiml, content_type='text/xml')

        # language detection
        if not session.language:
            language = detect_language_from_speech(user_speech)
            session.language = language

        # city detection
        if not session.user_city:
            detected = detect_city_from_text(user_speech)
            if detected:
                session.user_city = detected

        from .agent import (
            detect_intent, extract_filters_from_speech,
            extract_hospital_name_from_speech, build_sms_text,
        )

        intent   = detect_intent(user_speech, awaiting_sms=False)
        filters  = extract_filters_from_speech(user_speech)
        is_emergency = meta.get('is_emergency', False)

        exit_words = ['bye', 'goodbye', 'thank you', 'thanks',
                      "that's all", 'dhanyawad', 'shukriya', 'ok bye']
        is_exit = any(w in user_speech.lower() for w in exit_words)

        # ══ EMERGENCY SOS FLOW ══════════════════════════════════
        if is_emergency and len(user_speech) > 5 and not is_exit and intent != 'sms_confirm':
            sos_stage = meta.get('sos_stage', 'initial')
            print("[SOS] stage=" + sos_stage + " | speech=" + user_speech[:80])

            # STAGE 1: Triage + find hospitals
            if sos_stage == 'initial':
                from apps.triage.unified_triage import unified_analyze
                from apps.triage.needs_profiler import profile_care_needs
                from apps.hospitals.routing import rank_hospitals_for_case

                triage_result = unified_analyze(
                    symptoms_text=user_speech,
                    patient_age=meta.get('age'),
                    patient_gender=meta.get('gender'),
                    known_conditions=meta.get('known_conditions'),
                )
                print("[SOS] Triage: " + triage_result.get('p_level', '?'))

                needs_profile = profile_care_needs(
                    p_level=triage_result['p_level'],
                    doctor_category=triage_result.get('doctor_category'),
                    possible_conditions=triage_result.get('possible_conditions', []),
                    red_flags=triage_result.get('red_flags', []),
                    patient_age=meta.get('age'),
                    symptoms_text=user_speech,
                )

                lat = meta.get('location_lat')
                lng = meta.get('location_lng')
                ranked_hospitals = []
                if lat is not None and lng is not None:
                    try:
                        ranked_hospitals = rank_hospitals_for_case(
                            lat=float(lat), lng=float(lng),
                            needs_profile=needs_profile,
                            severity=triage_result['p_level'],
                            max_results=3,
                        )
                        print("[SOS] " + str(len(ranked_hospitals)) + " hospitals found")
                    except Exception as e:
                        print("[SOS] Routing error: " + str(e))

                if not ranked_hospitals:
                    ranked_hospitals = [{'name': 'Bombay Hospital', 'hospital_id': None}]

                meta['sos_stage']            = 'waiting_hospital'
                meta['sos_triage_result']    = triage_result
                meta['sos_needs_profile']    = needs_profile
                meta['sos_ranked_hospitals'] = ranked_hospitals
                meta['sos_raw_symptoms']     = user_speech
                session.meta_data = meta
                session.save()
                print("[SOS] Saved waiting_hospital state, session=" + str(session.id))

                hosp_names = [h.get('name', 'Hospital').split('(')[0].strip() for h in ranked_hospitals]
                names_str = ', '.join(hosp_names)
                if language == 'hi':
                    prompt = "Theek hai. Aapke nazdeek " + str(len(hosp_names)) + " hospital hain: " + names_str + ". Kripya bataiye aapko kis hospital me jana hai?"
                else:
                    prompt = "Understood. We found " + str(len(hosp_names)) + " hospital(s) near you: " + names_str + ". Please tell me which hospital you want to go to."

                twiml = build_agent_listen_twiml(session_id, prompt, language)
                return HttpResponse(twiml, content_type='text/xml')

            # STAGE 2: Match hospital + dispatch ambulance
            elif sos_stage == 'waiting_hospital':
                ranked_hospitals = meta.get('sos_ranked_hospitals', [])
                matched_hospital = None

                for hosp in ranked_hospitals:
                    h_name = hosp.get('name', '').lower()
                    words = [w for w in h_name.split() if len(w) > 3]
                    if h_name in user_speech.lower() or any(w in user_speech.lower() for w in words):
                        matched_hospital = hosp
                        break

                if not matched_hospital and ranked_hospitals:
                    matched_hospital = ranked_hospitals[0]

                print("[SOS] Matched hospital: " + str(matched_hospital.get('name') if matched_hospital else 'None'))

                from apps.triage.views import create_emergency_case_internal
                symptoms_text = meta.get('sos_raw_symptoms', 'Emergency SOS call')

                case_data = {
                    'patient_name'    : meta.get('patient_name', 'Emergency Patient'),
                    'symptoms_text'   : symptoms_text,
                    'age'             : meta.get('age'),
                    'phone'           : session.call_log.to_number.replace('+91', ''),
                    'gender'          : meta.get('gender'),
                    'known_conditions': meta.get('known_conditions'),
                    'location_lat'    : meta.get('location_lat'),
                    'location_lng'    : meta.get('location_lng'),
                    'triage_result'   : meta.get('sos_triage_result'),
                    'needs_profile'   : meta.get('sos_needs_profile'),
                    'ranked_hospitals': ranked_hospitals,
                    'top_hospital_id' : matched_hospital.get('hospital_id') if matched_hospital else None,
                }

                result = create_emergency_case_internal(case_data)
                print("[SOS] Case result: success=" + str(result.get('success')) + " error=" + str(result.get('error', '')))

                from twilio.twiml.voice_response import VoiceResponse
                from .services import VOICE_EN, VOICE_HI, LANG_EN, LANG_HI
                response = VoiceResponse()

                if result.get('success'):
                    case_id = result['case_id']
                    top_hosp_name = matched_hospital.get('name', 'the nearest hospital') if matched_hospital else 'the nearest hospital'
                    print("[SOS] SUCCESS: case=" + str(case_id) + " hospital=" + str(top_hosp_name))

                    tracking_link = "http://localhost:5173/track/" + str(case_id)
                    send_sms(session.call_log.to_number,
                             "Ambulance dispatched from " + top_hosp_name + ".\\nTrack live: " + tracking_link)

                    meta['case_id'] = case_id
                    session.resolved = True
                    session.meta_data = meta
                    session.save()

                    if language == 'hi':
                        reply = "Ghabrayein nahi. " + top_hosp_name + " se ambulance aa rahi hai. Aapko SMS mil gaya hoga. Apna khayal rakhein."
                    else:
                        reply = "Please stay calm. An ambulance has been dispatched from " + top_hosp_name + ". You will receive an SMS with a tracking link. Take care."
                else:
                    if language == 'hi':
                        reply = "Maaf kijiye, technical samasya aayi. Kripya 108 par call karein."
                    else:
                        reply = "I'm sorry, there was a technical issue. Please call 108 immediately."

                response.say(reply,
                             voice=VOICE_HI if language == 'hi' else VOICE_EN,
                             language=LANG_HI if language == 'hi' else LANG_EN)
                response.hangup()
                return HttpResponse(str(response), content_type='text/xml')

        # SMS send
        if intent == 'sms_confirm':
            to_number     = session.call_log.to_number
            last_filters  = meta.get('last_filters', {})
            last_hospital = meta.get('last_hospital_name')
            last_intent   = meta.get('last_intent', 'general')

            sms_text = build_sms_text(
                city=session.user_city or '', intent=last_intent,
                filters=last_filters, hospital_name=last_hospital, language=language,
            )
            send_sms(to_number, sms_text)
            session.resolved = True
            session.save()

            reply = ('Bilkul! Details SMS kar di gayi hain. Apna khayal rakhein!'
                     if language == 'hi' else
                     'Done! Hospital details sent to your phone. Take care!')
            from twilio.twiml.voice_response import VoiceResponse
            from .services import VOICE_HI, VOICE_EN, LANG_HI, LANG_EN
            response = VoiceResponse()
            response.say(reply, voice=VOICE_HI if language == 'hi' else VOICE_EN,
                         language=LANG_HI if language == 'hi' else LANG_EN)
            response.hangup()
            return HttpResponse(str(response), content_type='text/xml')

        # exit
        if is_exit and len(session.conversation_history) > 2:
            session.resolved  = True
            session.meta_data = meta
            session.save()
            return HttpResponse(build_agent_end_twiml(language), content_type='text/xml')

        # track last context
        if session.user_city:
            h_name = extract_hospital_name_from_speech(user_speech, session.user_city)
            if h_name:
                meta['last_hospital_name'] = h_name
        meta['last_filters'] = filters
        meta['last_intent']  = intent

        # Groq conversation
        history = session.conversation_history or []
        history.append({'role': 'user', 'content': user_speech})
        agent_response = ask_groq(
            conversation_history=history, language=language,
            city=session.user_city, filters=filters, intent=intent,
            is_emergency=is_emergency, user_data=meta if is_emergency else None,
        )
        history.append({'role': 'assistant', 'content': agent_response})
        if len(history) > 12:
            history = history[-12:]

        session.conversation_history = history
        session.meta_data = meta
        session.save()

        spoken_response = agent_response
        if not meta.get('end_note_shown') and len(history) >= 4 and session.user_city:
            meta['end_note_shown'] = True
            session.meta_data = meta
            session.save()
            tip = ('Aap yeh jaankari SMS par bhi pa sakte hain.'
                   if language == 'hi' else
                   'You can also get this info on SMS.')
            spoken_response = agent_response + ' ' + tip

        twiml = build_agent_listen_twiml(session_id, spoken_response, language)
        return HttpResponse(twiml, content_type='text/xml')
"""

# Read current file
with open('D:/gdg hackethon/backend/apps/calls/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Find line with "# 2. Replace AgentProcessWebhookView" (line index 398 = line 399)
# and the CallStatusWebhookView start
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if '# 2. Replace AgentProcessWebhookView' in line:
        start_idx = i
    if '@method_decorator(csrf_exempt' in line and start_idx and i > start_idx + 5:
        # This is the next class after AgentProcessWebhookView
        if 'CallStatusWebhookView' in '\n'.join(lines[i:i+5]):
            end_idx = i
            break

print(f"start_idx={start_idx}, end_idx={end_idx}")

if start_idx is not None and end_idx is not None:
    new_lines = lines[:start_idx] + new_class.split('\n') + lines[end_idx:]
    with open('D:/gdg hackethon/backend/apps/calls/views.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    print("File written successfully. Total lines:", len(new_lines))
else:
    print("ERROR: Could not find markers in file!")
    print("Looking for start marker...")
    for i, l in enumerate(lines):
        if 'AgentProcessWebhookView' in l:
            print(f"  Line {i+1}: {l[:80]}")

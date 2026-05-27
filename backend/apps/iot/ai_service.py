"""
apps/iot/ai_service.py — Voice and display text generation for ESP32.
Pill weights are now measured physically via HX711 load cell during filling.
No AI estimation needed.
"""

TIME_SLOT_NAMES = {
    'morning_before': 'Morning Before Food',
    'morning_after':  'Morning After Food',
    'night_before':   'Night Before Food',
    'night_after':    'Night After Food',
}


def generate_voice_text(time_slot: str, sub_compartments) -> str:
    """
    Build voice announcement text for ESP32 at dose time.
    sub_compartments: queryset or list with .medicine_name, .quantity_per_dose, .instructions
    """
    slot_name = TIME_SLOT_NAMES.get(time_slot, time_slot.replace('_', ' ').title())
    subs = list(sub_compartments)

    if not subs:
        return f"Time for your {slot_name} medicines."

    parts = []
    for s in subs:
        qty = getattr(s, 'quantity_per_dose', 1)
        name = getattr(s, 'medicine_name', 'medicine')
        pill_word = 'pill' if qty == 1 else 'pills'
        parts.append(f"{qty} {name} {pill_word}")

    if len(parts) == 1:
        medicine_list = parts[0]
    else:
        medicine_list = ', '.join(parts[:-1]) + ' and ' + parts[-1]

    instruction = ''
    for s in subs:
        inst = getattr(s, 'instructions', '')
        if inst:
            instruction = inst.strip()
            break

    text = f"Time for your {slot_name} medicines. Please take {medicine_list}."
    if instruction:
        text += f" {instruction}"
    return text


def generate_display_text(time_slot: str, sub_compartments) -> str:
    """
    Build compact OLED display text for ESP32.
    Max ~4 lines of ~20 chars each.
    """
    slot_name = TIME_SLOT_NAMES.get(time_slot, time_slot.replace('_', ' ').title())
    subs = list(sub_compartments)

    lines = [slot_name]
    for s in subs:
        qty = getattr(s, 'quantity_per_dose', 1)
        name = getattr(s, 'medicine_name', 'Med')
        lines.append(f"{name[:14]} x{qty}")

    for s in subs:
        inst = getattr(s, 'instructions', '')
        if inst:
            lines.append(inst[:20])
            break

    return '\n'.join(lines)

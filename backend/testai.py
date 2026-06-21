import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.triage.unified_triage import unified_analyze
from apps.triage.needs_profiler import profile_care_needs

print("=== TEST 1: Unresponsive elderly patient — expected P1 ===")
r = unified_analyze(
    "my mom fell and is not responding properly and her breathing sounds weird",
    patient_age=72, patient_gender="female"
)
print(f"  p_level      : {r['p_level']}")
print(f"  severity     : {r['severity_label']}")
print(f"  confidence   : {r['confidence']}")
print(f"  doctor       : {r['doctor_category']}")
print(f"  escalated    : {r['was_escalated']}")
print(f"  red_flags    : {r['red_flags']}")
print(f"  reasoning    : {r['reasoning'][:150]}")
print()

print("=== TEST 2: Mild headache — expected P3 or P4 ===")
r2 = unified_analyze("mild headache for 2 days", patient_age=35)
print(f"  p_level      : {r2['p_level']}")
print(f"  severity     : {r2['severity_label']}")
print(f"  confidence   : {r2['confidence']}")
print()

print("=== TEST 3: Classic MI presentation — expected P1 ===")
r3 = unified_analyze("chest pain radiating to left arm, sweating heavily, feeling nauseous, 55 year old male")
print(f"  p_level      : {r3['p_level']}")
print(f"  severity     : {r3['severity_label']}")
print(f"  confidence   : {r3['confidence']}")
print()

print("=== TEST 4: Child with high fever — expected P2 minimum ===")
r4 = unified_analyze("child with high fever 104 F and rash all over body", patient_age=4)
print(f"  p_level      : {r4['p_level']}")
print(f"  severity     : {r4['severity_label']}")
print(f"  confidence   : {r4['confidence']}")
print()

print("=== TEST 5: Mild cold — expected P4 ===")
r5 = unified_analyze("I think I might have a cold, stuffy nose for a day")
print(f"  p_level      : {r5['p_level']}")
print(f"  severity     : {r5['severity_label']}")
print()

print("=== TEST 6: Needs profiler - Stroke presentation ===")
np = profile_care_needs("P1", "Neurology", ["Stroke", "TBI"], ["unresponsive", "abnormal breathing"], 72, "fell not responding")
print(f"  bed_type     : {np['required_bed_type']}")
print(f"  services     : {np['required_services']}")
print(f"  time_window  : {np['time_sensitivity_minutes']} min")
print(f"  ventilator   : {np['requires_ventilator']}")
print(f"  reasoning    : {np['profile_reasoning'][:120]}")
print()

print("=== ALL TESTS COMPLETE ===")
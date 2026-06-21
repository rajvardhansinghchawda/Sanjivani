import re

with open('D:/gdg hackethon/frontend/hospital/src/pages/TriageDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

fetch_code = '''
    // Fetch initial cases
    fetch(`${API_BASE}/api/triage/cases/`)
      .then(res => res.json())
      .then(data => {
        if (data.results) {
          setCases(data.results);
          updateStats(data.results);
        } else if (Array.isArray(data)) {
          setCases(data);
          updateStats(data);
        }
      })
      .catch(err => console.error("Failed to load cases:", err));
'''

# Find the start of the useEffect
target = 'const ws = new WebSocket(`ws://${WS_HOST}/ws/triage/`);'
if target in content:
    content = content.replace(target, fetch_code + '\n    ' + target)
    print('Added fetch to TriageDashboard')
else:
    print('Failed to find insertion point')

with open('D:/gdg hackethon/frontend/hospital/src/pages/TriageDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

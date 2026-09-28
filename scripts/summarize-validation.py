import json, os
r = json.load(open(os.path.join(os.path.dirname(__file__), "..", "validation", "report.json")))
tot, lines = {}, []
for e in r.get("entry", [r]):
    oo = e.get("resource", e)
    name = next((x.get("valueString", "?") for x in oo.get("extension", []) if "file" in x["url"]), "?").split("/")[-1]
    for i in oo.get("issue", []):
        tot[i["severity"]] = tot.get(i["severity"], 0) + 1
        if i["severity"] in ("error", "fatal", "warning"):
            lines.append(f"- `{name}` **{i['severity']}**: {i.get('details', {}).get('text', i.get('diagnostics', ''))}")
md = ["# Validation summary", "", "HL7 FHIR validator (FHIR 4.0.1) against the HL7 Europe OneAquaHealth IG (built from hl7-eu/oah) and the Tributary IG.", "",
      f"**Errors: {tot.get('error', 0) + tot.get('fatal', 0)} · Warnings: {tot.get('warning', 0)} · Information: {tot.get('information', 0)}**", "", *lines]
open(os.path.join(os.path.dirname(__file__), "..", "validation", "SUMMARY.md"), "w").write("\n".join(md) + "\n")
print("\n".join(md[4:5]))

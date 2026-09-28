"""Export sample resources from a running Tributary server for validation."""
import json, os, sys, urllib.request

B = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000") + "/fhir"
OUT = os.path.join(os.path.dirname(__file__), "..", "validation", "resources")
os.makedirs(OUT, exist_ok=True)
get = lambda u: json.load(urllib.request.urlopen(B + u))

out = {
    "Location-giofyros-1": get("/Location/giofyros-1"),
    "Group-cohort-giofyros-1": get("/Group/cohort-giofyros-1"),
    "Observation-health-giofyros-1": get("/Observation/health-giofyros-1-gastrointestinal"),
}
for h in ["waterborne", "cyanobacteria", "vector"]:
    out[f"RiskAssessment-giofyros-1-{h}"] = get(f"/RiskAssessment/risk-giofyros-1-{h}")
seen = set()
for e in get("/Observation?subject=Location/giofyros-1&_count=500")["entry"]:
    r = e["resource"]
    code = r["code"]["coding"][0]["code"]
    if code in seen or r["id"].startswith("health"):
        continue
    seen.add(code)
    out[f"Observation-{code}"] = r
    if code == "foam":
        out["Provenance-foam"] = get(f"/Provenance/prov-{r['id']}")
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
for k, v in out.items():
    json.dump(v, open(os.path.join(OUT, f"{k}.json"), "w"), indent=2)
print(f"exported {len(out)} resources")

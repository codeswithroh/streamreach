#!/usr/bin/env bash
# Validate live Tributary resources with the official HL7 FHIR validator against
# the HL7 Europe OneAquaHealth IG (built from hl7-eu/oah) and Tributary's IG (ig/).
# Needs: Java 17+, a running server (npm run dev), network access to tx.fhir.org.
set -euo pipefail
cd "$(dirname "$0")/.."
WORK=${WORK:-.validation-cache}
mkdir -p "$WORK"
[ -f "$WORK/validator_cli.jar" ] || curl -sL -o "$WORK/validator_cli.jar" https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
if [ ! -d "$WORK/oah" ]; then
  git clone --depth 1 -q https://github.com/hl7-eu/oah "$WORK/oah"
  (cd "$WORK/oah" && npx --yes fsh-sushi build . >/dev/null)
fi
mkdir -p "$WORK/oahdefs" && cp "$WORK"/oah/fsh-generated/resources/{StructureDefinition,CodeSystem,ValueSet}-*.json "$WORK/oahdefs/"
(cd ig && npx --yes fsh-sushi build . >/dev/null)
python3 scripts/export-samples.py "${1:-http://localhost:3000}"
java -jar "$WORK/validator_cli.jar" -version 4.0.1 -ig "$WORK/oahdefs" -ig ig/fsh-generated/resources \
  -output validation/report.json validation/resources/*.json | tee validation/validator.log | tail -3
python3 scripts/summarize-validation.py

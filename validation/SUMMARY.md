# Validation summary

HL7 FHIR validator (FHIR 4.0.1) against the HL7 Europe OneAquaHealth IG (built from hl7-eu/oah) and the StreamReach IG.

**Errors: 0 · Warnings: 4 · Information: 80**

- `Group-cohort-giofyros-1.json` **warning**: None of the codings provided are in the value set 'OAH Cohort Characteristic Code' (http://hl7.eu/fhir/ig/oah/ValueSet/oah-cohort-characteristic-code-vs), and a coding should come from this value set unless it has no suitable code (note that the validator cannot judge what is suitable) (codes = http://snomed.info/sct#20733006)
- `Location-giofyros-1.json` **warning**: None of the codings provided are in the value set 'ServiceDeliveryLocationRoleType' (http://terminology.hl7.org/ValueSet/v3-ServiceDeliveryLocationRoleType|3.0.0), and a coding should come from this value set unless it has no suitable code (note that the validator cannot judge what is suitable) (codes = http://snomed.info/sct#420531007)
- `Observation-coliforms.json` **warning**: UCUM Codes that contain human readable annotations like {CFU} can be misleading (e.g. they are ignored when comparing units). Best Practice is not to depend on annotations in the UCUM code, so this usage should be checked
- `Observation-health-giofyros-1.json` **warning**: UCUM Codes that contain human readable annotations like {cases} can be misleading (e.g. they are ignored when comparing units). Best Practice is not to depend on annotations in the UCUM code, so this usage should be checked

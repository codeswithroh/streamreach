Extension: AssessedLocation
Id: assessed-location
Title: "Assessed stream reach"
Description: "The OAH Location (stream reach) whose conditions this risk is about. RiskAssessment.subject is the exposed people."
Context: RiskAssessment
* value[x] only Reference($LocationOah)

Extension: AssessmentConfidenceExt
Id: assessment-confidence
Title: "Assessment confidence"
Description: "Confidence in the estimate given evidence freshness, with a human-readable reason."
Context: RiskAssessment
* value[x] only CodeableConcept
* valueCodeableConcept from AssessmentConfidenceVS (required)

Extension: RiskFactor
Id: risk-factor
Title: "Explained risk factor"
Description: "One named factor of an explainable additive (log-odds) risk model: its normalised value, weight, contribution and a plain-language explanation."
Context: RiskAssessment
* extension contains
    factor 1..1 and
    source 1..1 and
    value 1..1 and
    weight 1..1 and
    contribution 1..1 and
    explanation 1..1
* extension[factor].value[x] only Coding
* extension[factor].valueCoding from StreamRiskFactorVS (extensible)
* extension[source].value[x] only code
* extension[source] ^short = "forecast | weather | citizen | lab | site | clinical"
* extension[value].value[x] only decimal
* extension[value] ^short = "Normalised factor value 0..1"
* extension[weight].value[x] only decimal
* extension[contribution].value[x] only decimal
* extension[contribution] ^short = "weight × value, in log-odds"
* extension[explanation].value[x] only string

ValueSet: StreamRiskFactorVS
Id: risk-factor-vs
Title: "Stream risk factors"
Description: "All named factors."
* include codes from system StreamRiskFactor

Profile: StreamExposedCohort
Parent: Group
Id: stream-exposed-cohort
Title: "Stream-exposed cohort"
Description: "People living near an urban stream reach: the population a stream-exposure RiskAssessment is about. Instances also declare conformance to the OAH GroupOah profile, whose constraints are restated here."
* type = #person
* actual = false
* member 0..0
* characteristic.exclude = false
* quantity 1..1
* quantity ^short = "Approximate residents within 1 km"
* characteristic 1..*
* characteristic.valueReference only Reference($LocationOah)

Profile: StreamExposureRisk
Parent: RiskAssessment
Id: stream-exposure-risk
Title: "Stream-exposure risk assessment"
Description: "Daily probability that people near an urban stream reach are exposed to a One Health hazard, with the factors that produced it."
* status = #final
* code 1..1
* code from StreamHazardVS (required)
* method 1..1
* subject only Reference(Group)
* subject ^short = "Stream-exposed cohort (StreamExposedCohort profile)"
* occurrence[x] 1..1
* occurrence[x] only dateTime
* extension contains
    AssessedLocation named assessedLocation 1..1 and
    AssessmentConfidenceExt named confidence 1..1 and
    RiskFactor named factor 0..*
* prediction 1..*
* prediction.outcome 1..1
* prediction.outcome from StreamHazardVS (required)
* prediction.probability[x] 1..1
* prediction.probability[x] only decimal
* prediction.qualitativeRisk 1..1
* prediction.when[x] 1..1
* prediction.when[x] only Period
* mitigation 1..1

ValueSet: AssessmentConfidenceVS
Id: confidence-vs
Title: "Assessment confidence"
Description: "All confidence levels."
* include codes from system AssessmentConfidence

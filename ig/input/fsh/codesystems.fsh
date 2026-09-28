CodeSystem: StreamFlowState
Id: flow-state
Title: "Stream flow state (citizen-observable)"
Description: "Flow states a volunteer can judge by eye. The OAH IG models hydrology as an indicator but has no coded values for it."
* ^caseSensitive = true
* ^experimental = false
* #dry "Dry bed"
* #stagnant "Standing water, no visible flow"
* #low "Low flow"
* #normal "Normal flow"
* #high "High / turbid flow"

CodeSystem: StreamHazard
Id: stream-hazard
Title: "One Health hazards arising from urban streams"
Description: "Hazards whose short-term risk StreamReach forecasts for people living near an urban stream reach."
* ^caseSensitive = true
* ^experimental = false
* #waterborne "Waterborne enteric pathogen exposure" "Campylobacter, Cryptosporidium, Giardia, pathogenic E. coli and similar, typically after sewer overflow."
* #cyanobacteria "Cyanobacterial toxin exposure" "Toxins from harmful cyanobacterial blooms in warm, slow, nutrient-rich water."
* #vector "Mosquito-borne arbovirus exposure" "Culex-borne arboviruses such as West Nile virus breeding in stream margins and pools."

CodeSystem: StreamRiskFactor
Id: risk-factor
Title: "Stream risk factors"
Description: "Named factors of the StreamReach explainable risk models."
* ^caseSensitive = true
* ^experimental = false
* #overflow "Storm overflow likely"
* #flush "Runoff flush"
* #sewage-signs "Sewage signs reported"
* #coliforms "Faecal bacteria (lab)"
* #impervious "Sealed catchment"
* #clinical "Clinic signal"
* #water-temp "Warm water"
* #stagnation "Slow, still water"
* #sunshine "Strong sunshine"
* #nutrients "Nutrient-rich water"
* #warmth "Mosquito-friendly warmth"
* #pools "Breeding pools"
* #larvae "Larvae spotted"
* #endemic "Regional West Nile activity"

CodeSystem: RiskMethod
Id: risk-method
Title: "StreamReach risk methods"
Description: "Versioned risk model identifiers."
* ^caseSensitive = true
* #streamreach-logit-v1 "StreamReach explainable logistic model v1"

CodeSystem: AssessmentConfidence
Id: confidence
Title: "Assessment confidence"
Description: "How much fresh evidence stands behind a risk estimate."
* ^caseSensitive = true
* #low "Low" "No citizen check in 14 days; weather-only estimate."
* #medium "Medium" "One or two citizen checks in 14 days."
* #high "High" "Three or more citizen checks in 14 days."

CodeSystem: DataOrigin
Id: data-origin
Title: "Data origin"
Description: "Where an observation came from and whether it has been verified."
* ^caseSensitive = true
* #citizen-unverified "Citizen, awaiting verification"
* #citizen-verified "Citizen, verified by coordinator"
* #laboratory "Laboratory"

CodeSystem: CardOverrideReason
Id: override
Title: "CDS card override reasons"
Description: "Why a clinician dismissed a StreamReach card."
* ^caseSensitive = true
* #no-exposure "Patient reports no stream contact"
* #alt-dx "Alternative cause confirmed"

ValueSet: StreamHazardVS
Id: stream-hazard-vs
Title: "Stream hazards"
Description: "All StreamReach stream hazards."
* include codes from system StreamHazard

ValueSet: StreamFlowStateVS
Id: flow-state-vs
Title: "Stream flow states"
Description: "All citizen-observable flow states."
* include codes from system StreamFlowState

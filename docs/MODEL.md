# StreamReach risk model (v1): transparent by construction

Each hazard is a small **logistic model**:

```
p = sigmoid( intercept + Σ weightᵢ × factorᵢ )      factorᵢ ∈ [0, 1]
```

Every factor has a name, a data source (forecast, weather, citizen, lab, site or clinic), a normalised value, a weight and
a plain-language explanation. The UI, the FHIR `RiskAssessment` (as `risk-factor` extensions) and the CDS Hooks card all
show the same factors. There is no hidden layer.

Levels: **low** < 0.20 ≤ **moderate** < 0.40 ≤ **high** < 0.65 ≤ **very high**.
Each day from today to +6 days gets its own prediction. Alerts use the worst of today and the next 3 days.

> **Status of the weights.** The weights are *expert priors* informed by the literature below. They are not coefficients
> fitted to outcome data, because no such dataset existed for these reaches when we built this. The structure is designed
> for recalibration: once OneAquaHealth lab campaigns (E. coli, cyanotoxins, mosquito traps) and anonymous clinic signals
> accumulate, each hazard can be refitted as an ordinary logistic regression on the same named factors, and the weights
> stay interpretable.

## Waterborne enteric pathogens (Campylobacter, Cryptosporidium, Giardia, pathogenic E. coli)

Intercept −3.4

| Factor | Source | Definition | Weight |
|---|---|---|---|
| Storm overflow likely | forecast / weather | sigmoid((rain_d + 0.5·rain_{d−1} − T)/(0.25·T)) × min(1, (outfalls+1)/3), with T the reach's spill threshold (mm/day) | 2.4 |
| Runoff flush | forecast / weather | 72 h rain / (2·T) | 0.8 |
| Sewage signs reported | citizen | OAH `foam` = present 0.6 / extensive 1.0, decays with e^(−age/7 d) | 1.4 |
| Faecal bacteria (lab) | lab | log-scaled E. coli between 500 and 2000 CFU/100 mL, decays with e^(−age/21 d) | 1.5 |
| Sealed catchment | site | impervious share of catchment | 0.6 |
| Clinic signal | clinical | anonymous GI presentations linked to the reach in 14 d via CDS Hooks feedback, /4 | 1.2 |

Why: heavy rain triggers combined-sewer overflows, and GI illness visits rise in the days after (Jagai et al., *EHP* 2015;
Drayna et al., *EHP* 2010). The E. coli scale is anchored on the EU Bathing Water Directive 2006/7/EC inland thresholds
(500 excellent, 900 sufficient).

## Toxic cyanobacterial bloom

Intercept −4.2

| Factor | Source | Definition | Weight |
|---|---|---|---|
| Warm water | citizen / weather | sigmoid((Tw − 20 °C)/1.8). Tw is a citizen thermometer reading ≤ 5 d old, adjusted for the forecast; otherwise estimated as 0.75·T̄air(7 d) + 2.5 | 2.6 |
| Slow, still water | citizen + weather | ½(1 − min(1, rain₇/15 mm)) + ½·flow score (stagnant 1, low 0.7, dry 0.6, normal 0.2, high 0) | 1.3 |
| Strong sunshine | forecast / weather | mean sunshine hours (3 d)/12 | 0.7 |
| Nutrient-rich water | citizen | OAH `filamentous-algae` cover band/4, decays with e^(−age/14 d) | 1.6 |

Why: cyanobacteria out-compete other algae above ~20 °C in still, nutrient-rich water (Paerl & Huisman, *Science* 2008;
WHO *Guidelines on recreational water quality*, 2021).

## Mosquito-borne arbovirus (Culex / West Nile virus)

Intercept −4.3

| Factor | Source | Definition | Weight |
|---|---|---|---|
| Mosquito-friendly warmth | forecast / weather | sigmoid((T̄air(7 d) − 20 °C)/2.5) | 2.2 |
| Breeding pools | weather | min(1, rain 5 to 14 d ago / 25 mm) × (1 − min(1, rain last 72 h / 20 mm)) | 1.1 |
| Larvae spotted | citizen | OAH `diptera` present, decays with e^(−age/10 d) | 1.5 |
| Regional West Nile activity | site | 1 if WNV circulated in the country in recent seasons | 1.0 |

Why: West Nile amplification in Culex accelerates with temperature above ~20 °C, and pools left after rain then dry
spells favour breeding (Paz, *Phil Trans R Soc B* 2015).

## Confidence

Confidence is reported separately from risk, so a weather-only estimate never looks as certain as a well-observed one:
**high** means ≥ 3 distinct citizen check days in 14 d, **medium** means 1–2, **low** means none.

## Known limitations

- Water temperature is estimated from air temperature when no citizen reading exists.
- Spill thresholds, outfall counts and impervious shares for the demo reaches are plausible placeholders. A city
  deployment replaces them with utility data.
- The in-memory store resets on restart. Production would use a FHIR server (HAPI, Azure, Google) through the same REST
  interface.

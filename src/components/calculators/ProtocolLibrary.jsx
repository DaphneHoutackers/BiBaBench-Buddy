import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search, ChevronDown, ChevronUp, FlaskConical, Sparkles } from 'lucide-react';
import ProtocolAIChat from '@/components/calculators/ProtocolAIChat';

const PROTOCOLS = [
  {
    id: 'favorgenn-miniprep',
    name: 'FavorGenn Plasmid Mini-Prep Kit',
    category: 'DNA',
    tags: ['plasmid', 'miniprep', 'favorgenn', 'purification'],
    steps: [
      { text: 'Pellet 1.5-2 mL overnight bacterial culture at 10,000–12,000×g for 1 min. Discard supernatant completely.', special: null },
      { text: 'Resuspend pellet in 250 µL Buffer P1 (ensure RNase A is added). Vortex or pipette until fully homogeneous — no cell clumps.', special: null },
      { text: 'Add 250 µL Buffer P2. Invert tube 4-6 times gently. Incubate ≤5 min at RT. Solution should turn clear and viscous. DO NOT VORTEX — shears chromosomal DNA.', special: 'warning' },
      { text: 'Add 350 µL Buffer P3. Invert immediately 4-6 times until white precipitate forms. Centrifuge at ≥13,000 rpm for 10 min at RT.', special: null },
      { text: 'Carefully transfer supernatant to supplied spin column. Centrifuge 30-60 s. Discard flow-through.', special: null },
      { text: '(Optional) Add 500 µL Buffer PB for endotoxin removal. Centrifuge 30-60 s. Discard flow-through.', special: null },
      { text: 'Add 700 µL Buffer PW (ethanol added). Centrifuge 30-60 s. Discard flow-through.', special: null },
      { text: 'Centrifuge empty column for 1-2 min to remove residual ethanol. Transfer column to a fresh 1.5 mL tube.', special: null },
      { text: 'Elute with 30-50 µL pre-warmed MQ water or Buffer EB (10 mM Tris-HCl pH 8.5). Let stand 1-2 min. Centrifuge 1 min.', special: null },
      { text: 'Measure concentration by NanoDrop (A260/A280 should be ~1.8–2.0). Store at -20°C.', special: null },
    ]
  },
  {
    id: 'favorgenn-gel-pcr',
    name: 'FavorGenn Gel/PCR Purification Kit',
    category: 'DNA',
    tags: ['gel extraction', 'PCR cleanup', 'purification', 'favorgenn'],
    steps: [
      { text: 'FOR GEL EXTRACTION: Visualize band under UV (minimal UV exposure). Excise gel slice with clean scalpel. Weigh slice (should be <300 mg). FOR PCR CLEANUP: proceed directly to step 2.', special: 'warning' },
      { text: 'FOR GEL: Add 3 volumes Buffer QG per volume gel (100 mg gel ≈ 100 µL). Incubate at 50°C with occasional vortexing until gel is dissolved (~10 min). FOR PCR: Add 5 volumes Buffer PB to PCR product.', special: 'temp' },
      { text: 'Check solution is yellow (pH ≤7.5). If orange/violet, add 10 µL 3M sodium acetate pH 5.0.', special: null },
      { text: '(Gel only) Add 1 gel volume isopropanol. Mix.', special: null },
      { text: 'Transfer up to 750 µL to spin column. Centrifuge 30-60 s. Discard flow-through. Repeat if sample exceeds 750 µL.', special: null },
      { text: '(Gel only) Add 500 µL Buffer QG. Centrifuge 30-60 s. Discard flow-through.', special: null },
      { text: 'Add 750 µL Buffer PE (ethanol added). Centrifuge 30-60 s. Discard flow-through.', special: null },
      { text: 'Centrifuge empty column 1-2 min to remove residual ethanol.', special: null },
      { text: 'Transfer to fresh 1.5 mL tube. Add 30-50 µL pre-warmed MQ or EB. Let stand 1-2 min. Centrifuge 1 min.', special: null },
      { text: 'Quantify by NanoDrop or gel. Store at -20°C.', special: null },
    ]
  },
  {
    id: 'pcr',
    name: 'PCR Protocol',
    category: 'DNA',
    tags: ['PCR', 'amplification', 'polymerase chain reaction'],
    calcFields: [
      { label: 'Product length (bp)', id: 'productBp', default: '1000' },
      { label: 'Polymerase', id: 'polymerase', default: 'Phusion', isSelect: true, options: ['Phusion', 'Q5', 'Taq/DreamTaq', 'Pfu'] },
    ],
    calc: (vals) => {
      const bp = parseFloat(vals.productBp) || 1000;
      const extSec = Math.max(30, Math.ceil(bp / 1000 * 30));
      const extStr = extSec >= 60 ? `${Math.floor(extSec / 60)} min ${extSec % 60 > 0 ? extSec % 60 + 's' : ''}`.trim() : `${extSec}s`;
      const poly = vals.polymerase || 'Phusion';
      const denat = '98°C';
      const ext = poly === 'Pfu' ? '72°C' : '72°C';
      return `Denaturation: ${denat} 10s | Annealing: see Ta calculator | Extension: 72°C × ${extStr} | Cycles: 30-35`;
    },
    steps: [
      { text: 'Set up PCR mix on ice. Use PCR Mix calculator for exact volumes. Typical components: MQ, Template DNA, HF buffer, dNTPs, polymerase, forward primer, reverse primer.', special: 'ice' },
      { text: 'Prepare a mastermix if running multiple reactions (see PCR calculator). Add template last, individually per tube.', special: null },
      { text: 'Initial denaturation: 98°C × 30 s (high-fidelity polymerases) or 95°C × 2-5 min (Taq).', special: 'temp' },
      { text: 'Cycling (30-35 cycles): (a) Denaturation 98°C × 10 s, (b) Annealing at Ta × 30 s (see Ta calculator), (c) Extension 72°C × 30 s/kb.', special: 'temp', param: { label: 'Extension rate', options: { 'Phusion/Q5': '30 s/kb (15-20 s/kb for <1 kb)', 'Taq/DreamTaq': '1 min/kb', 'Pfu': '2 min/kb' } } },
      { text: 'Final extension: 72°C × 5-10 min.', special: 'temp' },
      { text: 'Hold at 4°C or proceed to gel analysis/cleanup.', special: 'ice' },
    ]
  },
  {
    id: 'bacterial-transformation',
    name: 'Bacterial Transformation (Heat Shock)',
    category: 'Cloning',
    tags: ['bacteria', 'transformation', 'plasmid', 'heat shock'],
    steps: [
      { text: 'Thaw competent cells on ice for 10-15 min. Do not vortex.', special: 'ice' },
      { text: 'Add 1-5 µL of plasmid DNA (≤50 ng) or ligation product to 25-50 µL competent cells. Flick gently to mix. Incubate on ice for 30 min.', special: 'ice' },
      { text: 'Heat shock at exactly 42°C. Do not exceed the recommended time.', special: 'temp', param: { label: 'Cell strain', options: { 'DH5α / TOP10': '42°C × 42 s', 'BL21(DE3)': '42°C × 30 s', 'Stbl3 (lentiviral)': '42°C × 25 s' } } },
      { text: 'Immediately return to ice for 2-5 min.', special: 'ice' },
      { text: 'Add 200-950 µL pre-warmed SOC or LB medium. Incubate at 37°C for 60 min with shaking at 250 rpm.', special: 'temp' },
      { text: 'Spread 50-200 µL onto selective LB agar plates. Incubate inverted at 37°C overnight (16-18 h).', special: null },
    ]
  },
  {
    id: 'miniprep-generic',
    name: 'Plasmid Miniprep (Alkaline Lysis — Generic)',
    category: 'DNA',
    tags: ['plasmid', 'purification', 'miniprep', 'alkaline lysis'],
    steps: [
      { text: 'Pellet 1.5-2 mL overnight culture at 8,000×g for 1 min. Discard supernatant completely.', special: null },
      { text: 'Resuspend pellet in 250 µL Buffer P1 (with RNase A). Vortex until no clumps remain.', special: null },
      { text: 'Add 250 µL Buffer P2. Invert 4-6 times gently. Incubate ≤5 min at RT. DO NOT VORTEX.', special: 'warning' },
      { text: 'Add 350 µL Buffer N3/P3. Invert 4-6 times until white precipitate forms.', special: null },
      { text: 'Centrifuge ≥13,000 rpm × 10 min. Transfer clear supernatant to spin column. Centrifuge 30-60 s, discard flow-through.', special: null },
      { text: '(Optional) Wash with 500 µL Buffer PB. Centrifuge 30-60 s, discard.', special: null },
      { text: 'Wash with 750 µL Buffer PE (ethanol). Centrifuge 30-60 s, discard.', special: null },
      { text: 'Centrifuge dry 1-2 min. Transfer to 1.5 mL tube.', special: null },
      { text: 'Elute with 30-50 µL pre-warmed MQ or EB. Stand 1-2 min, centrifuge 1 min.', special: null },
    ]
  },
  {
    id: 'gel-electrophoresis',
    name: 'Agarose Gel Electrophoresis',
    category: 'DNA',
    tags: ['gel', 'electrophoresis', 'agarose', 'DNA visualization'],
    calcFields: [
      { label: 'Agarose (%)', id: 'agarosePerc', default: '1' },
      { label: 'Gel volume (mL)', id: 'gelVol', default: '50' },
    ],
    calc: (vals) => {
      const perc = parseFloat(vals.agarosePerc) || 1;
      const vol = parseFloat(vals.gelVol) || 50;
      const midori = (vol * 0.05).toFixed(2); // 1:2000 dilution → 0.5 µL per 10 mL → 0.05 µL/mL
      return `Agarose: ${(perc * vol / 100).toFixed(2)} g in ${vol} mL 1× TAE. Midori Green: ${midori} µL (1:2000 dilution).`;
    },
    steps: [
      { text: 'Weigh agarose and dissolve in 1× TAE buffer by microwaving (use calculator above). Swirl every 30 s. Do not boil over.', special: null },
      { text: 'Cool to ~55°C. Add Midori Green (1:2000 dilution, see calculator). Swirl gently to mix. Do NOT use EtBr — Midori Green is non-mutagenic.', special: null },
      { text: 'Pour gel into sealed tray with comb. Let solidify 20-30 min at RT. Do not move.', special: null },
      { text: 'Remove comb and tape. Place in tank, submerge in 1× TAE buffer.', special: null },
      { text: 'Add 6× loading dye to samples (1 µL per 5 µL sample). Load 4 µL ladder and samples.', special: null },
      { text: 'Run at 80-120 V for 20-40 min. Monitor bromophenol blue dye front.', special: null },
      { text: 'Image on blue light transilluminator or UV with gel documentation system. Wear UV protection if using UV.', special: 'warning' },
    ]
  },
  {
    id: 'digestion',
    name: 'Restriction Enzyme Digestion',
    category: 'Cloning',
    tags: ['digestion', 'restriction enzyme', 'RE', 'cloning'],
    steps: [
      { text: 'Calculate required volumes using the Restriction Digest Calculator. Use ≥500 ng DNA for analytical, 1-5 µg for preparative digest.', special: null },
      { text: 'Set up on ice. Add MQ first, then DNA, then buffer (10×), then enzyme(s) last to prevent star activity.', special: 'ice' },
      { text: 'Incubate at optimal temperature (typically 37°C). For FastDigest enzymes: 5-15 min. For standard NEB enzymes: 1-2 h.', special: 'temp', param: { label: 'Enzyme type', options: { 'NEB CutSmart': '37°C × 1-2 h', 'Thermo FastDigest': '37°C × 5-15 min', 'Temp-sensitive (e.g., BclI)': '60°C × 1 h' } } },
      { text: 'Heat inactivate if applicable: 65°C × 20 min (most NEB enzymes) or 80°C × 20 min. Check NEB website for enzyme-specific protocols.', special: 'temp' },
      { text: 'For cloning: purify digest by column or gel extraction. For analytical: load directly onto agarose gel.', special: null },
    ]
  },
  {
    id: 'ligation',
    name: 'Ligation (T4 DNA Ligase)',
    category: 'Cloning',
    tags: ['ligation', 'T4 ligase', 'cloning', 'vector', 'insert'],
    steps: [
      { text: 'Calculate volumes using the Ligation Calculator. Recommended: 50 ng vector, 3:1 insert:vector molar ratio.', special: null },
      { text: 'Dephosphorylate vector (CIP/SAP treatment) after digestion and before ligation to reduce re-ligation background. Purify before ligation.', special: null },
      { text: 'Set up ligation on ice: MQ → Vector DNA → Insert DNA → 10× T4 Ligase Buffer → T4 DNA Ligase. Mix gently, spin down.', special: 'ice' },
      { text: 'Incubate according to method:', special: 'temp', param: { label: 'Protocol', options: { 'Sticky end (standard)': '16°C overnight (16-18 h)', 'Blunt end': '16°C overnight with PEG4000', 'Quick ligation (NEB)': '25°C × 5-15 min' } } },
      { text: 'Heat inactivate at 65°C × 10 min (T4 DNA Ligase). Place on ice.', special: 'temp' },
      { text: 'Transform 2-5 µL of ligation directly into competent cells. Also transform uncut vector and ligation without insert as controls.', special: null },
    ]
  },
  {
    id: 'gibson',
    name: 'Gibson Assembly',
    category: 'Cloning',
    tags: ['gibson', 'assembly', 'seamless cloning', 'NEBuilder'],
    steps: [
      { text: 'Design fragments with 20-30 bp overlapping homology regions. Order primers with overhangs or use restriction enzymes + exonuclease trimming.', special: null },
      { text: 'PCR-amplify and purify all fragments. Quantify by NanoDrop. Calculate volumes using the Gibson Assembly Calculator (100 ng vector, 3× molar excess insert).', special: null },
      { text: 'Thaw 2× NEBuilder HiFi Assembly Master Mix on ice. Set up reaction: MQ + fragments (≤5 µL total DNA) + 10 µL 2× Master Mix in 20 µL total.', special: 'ice' },
      { text: 'Incubate at 50°C × 15-60 min (use longer times for ≥3 fragments or >6 kb assemblies).', special: 'temp', param: { label: 'Fragments', options: { '2 fragments': '50°C × 15-30 min', '3-4 fragments': '50°C × 30-60 min', '>4 fragments': '50°C × 60 min' } } },
      { text: 'Place on ice immediately. Transform 2 µL into competent cells (e.g., DH5α or Stbl3 for repetitive sequences).', special: 'ice' },
      { text: 'Spread on selective plates, incubate overnight at 37°C. Screen colonies by colony PCR using flanking primers.', special: null },
    ]
  },
  {
    id: 'bacterial-lysis',
    name: 'Bacterial Cell Lysis (for Protein Purification)',
    category: 'Protein',
    tags: ['lysis', 'bacteria', 'E. coli', 'protein purification'],
    calcFields: [
      { label: 'Culture volume (mL)', id: 'cultVol', default: '100' },
    ],
    calc: (vals) => {
      const v = parseFloat(vals.cultVol) || 100;
      const lysisVol = Math.round(v / 10);
      return `Use ~${lysisVol} mL lysis buffer for ${v} mL culture. Sonicate on ice: 6× 30 s pulses with 30 s cooling intervals.`;
    },
    steps: [
      { text: 'Harvest cells by centrifugation at 4,000×g × 20 min at 4°C. Discard supernatant. Pellet can be stored at -80°C.', special: 'ice' },
      { text: 'Resuspend pellet in ice-cold lysis buffer (50 mM NaH₂PO₄, 300 mM NaCl, 10 mM imidazole, pH 8.0 for His-tag; add 1× protease inhibitors fresh).', special: 'ice' },
      { text: 'Lyse by sonication on ice: 6× 30 s pulses at 40% amplitude with 30 s cooling between pulses. Keep on ice at all times to prevent heat denaturation.', special: 'ice' },
      { text: 'Alternatively, use a French press (2× 18,000 psi) or enzymatic lysis (lysozyme 1 mg/mL, 30 min on ice, then sonicate briefly).', special: 'ice' },
      { text: 'Centrifuge 20,000×g × 30 min at 4°C to pellet cell debris. Transfer clear supernatant (soluble fraction) to new pre-chilled tube.', special: 'ice' },
      { text: 'Proceed to purification (e.g., Ni-NTA chromatography for His-tag). Keep all fractions on ice.', special: 'ice' },
    ]
  },
  {
    id: 'micro-bca',
    name: 'Micro BCA Assay (Protein Concentration)',
    category: 'Protein',
    tags: ['micro BCA', 'protein concentration', 'assay', 'standard curve'],
    steps: [
      { text: 'Prepare BSA standards from 2 mg/mL stock in the same diluent as samples (range: 0.5–20 µg/mL for Micro BCA): 0, 0.5, 1, 2, 4, 8, 12, 16, 20 µg/mL. Prepare standards in sample buffer to minimize matrix effects.', special: null },
      { text: 'Dilute samples if concentrated (typical starting point: 1:5 to 1:20 in assay buffer). Pipette 150 µL of each standard or sample into a microplate well (96-well flat-bottom). Duplicate or triplicate recommended.', special: null },
      { text: 'Prepare Micro BCA Working Reagent (WR): Mix reagents MA : MB : MC = 25 : 24 : 1 (v/v/v). Example: 1.25 mL MA + 1.20 mL MB + 50 µL MC = 2.5 mL WR total. Prepare fresh and use within 1 hour.', special: null },
      { text: 'Add 150 µL of Micro BCA Working Reagent to each well already containing 150 µL standard or sample (total volume 300 µL per well). Mix by pipetting 10× or with plate shaker at low speed for 30 s.', special: null },
      { text: 'Cover plate with adhesive film or lid. Incubate at 37°C × 2 h without shaking. Do NOT use elevated temperatures — Micro BCA uses lower protein concentrations than standard BCA and is more sensitive to heat.', special: 'temp' },
      { text: 'Remove plate, allow to cool to RT for 5-10 min. Measure absorbance at 562 nm on microplate reader.', special: null },
      { text: 'Subtract background (0 µg/mL standard = blank). Plot A562 vs concentration. Enter values into the Protein Concentration Calculator (Standard Curve tab) to generate regression and determine sample concentrations.', special: null },
    ]
  },
  {
    id: 'bca',
    name: 'BCA Assay (Protein Concentration)',
    category: 'Protein',
    tags: ['BCA', 'protein concentration', 'assay', 'standard curve'],
    steps: [
      { text: 'Prepare BSA standards at 0, 0.25, 0.5, 1, 2, 5, 10, 20, 40 µg/mL. Use the Protein Concentration Calculator for volumes (2 mg/mL BSA stock).', special: null },
      { text: 'Add 10-25 µL sample or standard per well. Samples in same buffer as standards.', special: null },
      { text: 'Prepare BCA Working Reagent: Mix Reagent A and Reagent B in 50:1 ratio (v/v). Prepare fresh and use within 24 h.', special: null },
      { text: 'Add 200 µL (96-well) or 2 mL (tube) BCA Working Reagent per sample/standard.', special: null },
      { text: 'Incubate at 37°C × 30 min (standard) or 60°C × 30 min (enhanced sensitivity). Do not shake during incubation.', special: 'temp', param: { label: 'Sensitivity', options: { 'Standard range (20-2000 µg/mL)': '37°C × 30 min', 'Enhanced sensitivity (<25 µg/mL)': '60°C × 30 min', 'Room temperature': 'RT × 2 h' } } },
      { text: 'Cool to RT. Measure at A562 nm.', special: null },
      { text: 'Enter values into Protein Concentration Calculator to generate regression curve and sample concentrations.', special: null },
    ]
  },
  {
    id: 'sds-page',
    name: 'SDS-PAGE',
    category: 'Protein',
    tags: ['SDS-PAGE', 'gel', 'protein', 'electrophoresis'],
    steps: [
      { text: 'Prepare samples using the SDS-PAGE Prep calculator (15 µg protein, 6× sample buffer, 40 µL total, complete with lysis buffer). Heat at 95°C × 5-10 min, spin briefly, keep on ice.', special: 'temp' },
      { text: 'Assemble gel apparatus. Fill inner chamber and outer chamber with 1× SDS-PAGE running buffer (25 mM Tris, 192 mM glycine, 0.1% SDS).', special: null },
      { text: 'Remove comb carefully. Flush wells with running buffer using a syringe.', special: null },
      { text: 'Load 4 µL pre-stained protein marker. Load samples into wells.', special: null },
      { text: 'Run at 80 V through stacking gel (15-20 min, until samples enter resolving gel), then increase to 120-150 V through resolving gel until dye front reaches bottom.', special: 'temp' },
      { text: 'For Coomassie: stain 1 h in Coomassie R-250; destain in 10% acetic acid / 10% methanol overnight. For Western blot: proceed to transfer.', special: null },
    ]
  },
  {
    id: 'western-blot',
    name: 'Western Blot',
    category: 'Protein',
    tags: ['western blot', 'immunoblot', 'protein', 'antibody'],
    steps: [
      { text: 'After SDS-PAGE, equilibrate gel and filter papers in transfer buffer for 5 min. PVDF membrane: pre-wet in 100% methanol 30 s → transfer buffer 5 min. Nitrocellulose: equilibrate in transfer buffer 5 min.', special: null },
      { text: 'Assemble semi-dry transfer sandwich from positive side (bottom) to negative side (top): Filter paper → PVDF/NC membrane → Gel → Filter paper. Remove all air bubbles by rolling with pipette.', special: null },
      { text: 'Semi-dry transfer: 15 V × 30-45 min (standard proteins). For large proteins (>100 kDa): 15 V × 60 min or wet transfer at 30 V overnight at 4°C.', special: 'temp', param: { label: 'Protein size', options: { 'Small (<30 kDa)': 'Semi-dry: 15 V × 20 min', 'Medium (30-100 kDa)': 'Semi-dry: 15 V × 30-45 min', 'Large (>100 kDa)': 'Wet: 30 V overnight at 4°C' } } },
      { text: 'Check transfer efficiency by Ponceau S staining (reversible, quick) or by staining gel with Coomassie to check protein depletion.', special: null },
      { text: 'Block membrane with 2% BSA in TBST for 1 h at RT with gentle rocking. (Use 5% non-fat milk for non-phospho-antibodies; use 2% BSA for phospho-antibodies).', special: null },
      { text: 'Incubate with primary antibody (in blocking buffer per manufacturer recommendation) overnight at 4°C with gentle rocking.', special: 'ice' },
      { text: 'Wash 3× with 1× TBST, 5-10 min each wash, with gentle rocking.', special: null },
      { text: 'Incubate with HRP-conjugated secondary antibody (1:5000–1:10000 in blocking buffer) for 1 h at RT with rocking.', special: null },
      { text: 'Wash 3× with 1× TBST, 5-10 min each. Final wash in TBS (no Tween) 5 min.', special: null },
      { text: 'Incubate with ECL reagent (mix A+B 1:1) for 1-5 min. Expose on chemiluminescence imaging system or X-ray film.', special: null },
    ]
  },
  {
    id: 'rna-extraction',
    name: 'RNA Extraction (TRIzol)',
    category: 'RNA',
    tags: ['RNA', 'extraction', 'TRIzol', 'total RNA'],
    calcFields: [
      { label: 'Culture/tissue volume (mL)', id: 'vol', default: '1' },
    ],
    calc: (vals) => {
      const v = parseFloat(vals.vol) || 1;
      return `TRIzol: ${v} mL | Chloroform: ${(v * 0.2).toFixed(1)} mL | Isopropanol: ${(v * 0.5).toFixed(1)} mL`;
    },
    steps: [
      { text: 'TRIzol and chloroform are toxic. Wear gloves throughout. Work in a fume hood for steps 2-4.', special: 'toxic' },
      { text: 'Lyse cells/tissue with 1 mL TRIzol per 10 cm² or per 1 mL culture. Pipette vigorously. Incubate 5 min at RT in fume hood.', special: 'fume hood' },
      { text: 'Add 200 µL chloroform per mL TRIzol in fume hood. Shake vigorously 15 s. Incubate 3 min at RT.', special: 'fume hood' },
      { text: 'Centrifuge 12,000×g × 15 min at 4°C. Three layers form: upper aqueous (RNA), white interphase (DNA), lower organic (protein).', special: 'ice' },
      { text: 'Carefully transfer ONLY the upper aqueous phase to a new tube. Do NOT disturb interphase — DNA contamination.', special: 'warning' },
      { text: 'Add 500 µL isopropanol per mL TRIzol. Mix. Incubate 10 min at RT. Centrifuge 12,000×g × 10 min at 4°C.', special: 'ice' },
      { text: 'Discard supernatant carefully. Wash pellet with 1 mL 75% ethanol (DEPC-treated or RNase-free water). Centrifuge 7,500×g × 5 min at 4°C.', special: null },
      { text: 'Air dry pellet 5-10 min at RT — do not over-dry. Dissolve in DEPC-treated water at 55-60°C × 10 min.', special: 'temp' },
      { text: 'Measure by NanoDrop: A260/A280 ~2.0 (RNA). A260/A230 >1.8. Store at -80°C.', special: null },
    ]
  },
  {
    id: 'lysis-cell-culture',
    name: 'Mammalian Cell Lysis (RIPA)',
    category: 'Protein',
    tags: ['lysis', 'protein', 'cell culture', 'RIPA', 'mammalian'],
    calcFields: [
      { label: 'Plate size', id: 'plateSize', default: '10 cm', isSelect: true, options: ['6 cm', '10 cm', '15 cm', '6-well', '12-well', '24-well'] },
    ],
    calc: (vals) => {
      const size = vals.plateSize || '10 cm';
      const vol = { '6 cm': 200, '10 cm': 500, '15 cm': 1000, '6-well': 150, '12-well': 100, '24-well': 60 }[size] || 500;
      return `Use ~${vol} µL RIPA buffer for a ${size} plate/well.`;
    },
    steps: [
      { text: 'Prepare RIPA buffer on ice with fresh protease inhibitors: 1× cocktail + 1 mM PMSF. PMSF is toxic and unstable — add immediately before use in fume hood.', special: 'toxic' },
      { text: 'Aspirate medium. Wash cells 2× with ice-cold PBS.', special: 'ice' },
      { text: 'Add RIPA buffer (see calculator) directly to cells on ice. Scrape with cell scraper immediately.', special: 'ice' },
      { text: 'Transfer lysate to pre-chilled 1.5 mL tube. Rotate end-over-end for 30 min at 4°C. Do NOT vortex — degrades protein complexes.', special: 'ice' },
      { text: 'Centrifuge 13,000×g × 15 min at 4°C. Transfer supernatant to new tube on ice.', special: 'ice' },
      { text: 'Measure protein concentration by BCA or Bradford assay. Aliquot and store at -80°C. Avoid freeze-thaw cycles.', special: null },
    ]
  },
  {
    id: 'bradford',
    name: 'Bradford Assay (Protein Concentration)',
    category: 'Protein',
    tags: ['bradford', 'protein concentration', 'assay', 'coomassie'],
    steps: [
      { text: 'Prepare BSA standards: 0, 50, 100, 200, 300, 400, 500, 600, 800, 1000 µg/mL from 2 mg/mL stock in the same buffer as samples.', special: null },
      { text: 'Add 10 µL standard or sample to microplate well (in duplicate/triplicate). Dilute samples as needed (Bradford range: 5–100 µg/mL for microassay; 200–1400 µg/mL for standard assay).', special: null },
      { text: 'Add 200 µL Bradford reagent per well. Mix by pipetting. Incubate 5 min at RT. Do not incubate >1 hour (color may fade).', special: null },
      { text: 'Read absorbance at 595 nm (A595). Subtract blank (reagent + buffer only).', special: null },
      { text: 'Plot A595 vs BSA concentration. Use standard curve regression to calculate sample concentrations.', special: null },
    ]
  },
  {
    id: 'qpcr',
    name: 'qPCR / RT-qPCR',
    category: 'RNA',
    tags: ['qPCR', 'RT-qPCR', 'gene expression', 'quantitative PCR'],
    calcFields: [
      { label: 'Number of samples', id: 'nSamples', default: '8' },
    ],
    calc: (vals) => {
      const n = parseInt(vals.nSamples) || 8;
      const mm = ((n + 2) * 5).toFixed(0);
      return `Mastermix for ${n} samples (+2 extra): ${mm} µL 2× SYBR mix + ${((n+2)*0.5).toFixed(0)} µL Fwd primer + ${((n+2)*0.5).toFixed(0)} µL Rev primer + ${((n+2)*4).toFixed(0)} µL MQ = ${((n+2)*10).toFixed(0)} µL total mastermix. Add 2 µL cDNA per well.`;
    },
    steps: [
      { text: 'Synthesize cDNA from RNA using reverse transcriptase (e.g., SuperScript, RevertAid) with oligo-dT or random hexamers per manufacturer protocol. Store cDNA at -20°C.', special: 'ice' },
      { text: 'Dilute cDNA 1:5 to 1:20 in nuclease-free water before use. Too concentrated cDNA inhibits PCR.', special: null },
      { text: 'Prepare mastermix (see calculator). Use 10 µL reaction volume per well: 5 µL 2× SYBR Green mix + 0.5 µL Fwd primer (10 µM) + 0.5 µL Rev primer (10 µM) + 2 µL cDNA + 2 µL MQ.', special: 'ice' },
      { text: 'Seal plate with optical adhesive film. Briefly centrifuge (300×g × 1 min) to remove bubbles.', special: null },
      { text: 'qPCR cycling: 95°C × 10 min (initial denaturation) → 40 cycles of [95°C × 15 s, 60°C × 1 min] → melt curve (60–95°C, 0.3°C/step).', special: 'temp' },
      { text: 'Analyze with ΔΔCt method. Normalize to reference genes (e.g., GAPDH, ACTB). Melt curve should show a single peak — multiple peaks indicate primer dimers or non-specific amplification.', special: null },
    ]
  },
  {
    id: 'cell-culture-passaging',
    name: 'Cell Culture — Passaging Adherent Cells',
    category: 'Cell Culture',
    tags: ['cell culture', 'passaging', 'trypsin', 'adherent cells', 'HEK293', 'HeLa'],
    calcFields: [
      { label: 'Flask size', id: 'flask', default: 'T75', isSelect: true, options: ['T25', 'T75', 'T175', '6-well', '10 cm', '15 cm'] },
      { label: 'Split ratio', id: 'split', default: '5' },
    ],
    calc: (vals) => {
      const vol = { 'T25': { medium: 5, trypsin: 1 }, 'T75': { medium: 15, trypsin: 3 }, 'T175': { medium: 25, trypsin: 5 }, '6-well': { medium: 2, trypsin: 0.5 }, '10 cm': { medium: 10, trypsin: 2 }, '15 cm': { medium: 20, trypsin: 3 } }[vals.flask] || { medium: 15, trypsin: 3 };
      return `Trypsin: ${vol.trypsin} mL | Neutralize with ${vol.trypsin * 3} mL complete medium | Total suspension: ~${vol.trypsin + vol.trypsin * 3} mL → split 1:${vals.split}`;
    },
    steps: [
      { text: 'Pre-warm complete medium, PBS, and Trypsin-EDTA (0.25%) to 37°C in water bath before use.', special: 'temp' },
      { text: 'Aspirate medium from flask. Wash with pre-warmed PBS (1× flask volume). Aspirate PBS completely — residual serum inhibits trypsin.', special: null },
      { text: 'Add Trypsin-EDTA (see calculator). Incubate at 37°C for 2-5 min. Tap flask gently to detach cells. Do NOT over-trypsinize — damages cells.', special: 'temp' },
      { text: 'Add 3× volume complete medium to neutralize trypsin. Pipette up and down to break clumps. Transfer to 15/50 mL tube.', special: null },
      { text: 'Centrifuge 300×g × 3-5 min. Aspirate supernatant carefully (do not disturb pellet). Resuspend in fresh complete medium.', special: null },
      { text: 'Count cells (hemocytometer or automated counter). Seed at desired density into new flasks. Most adherent lines: passage at 70-80% confluency.', special: null },
      { text: 'Incubate at 37°C, 5% CO₂, 95% humidity. Check daily. Common split intervals: HEK293 — 2 days 1:5; HeLa — 2-3 days 1:5; primary cells — 3-4 days 1:3.', special: 'temp' },
    ]
  },
  {
    id: 'transfection-lipo',
    name: 'Transient Transfection (Lipofectamine 3000)',
    category: 'Cell Culture',
    tags: ['transfection', 'lipofectamine', 'plasmid', 'cell culture', 'HEK293'],
    calcFields: [
      { label: 'Well/plate format', id: 'format', default: '6-well', isSelect: true, options: ['24-well', '12-well', '6-well', '10 cm', '15 cm'] },
    ],
    calc: (vals) => {
      const f = vals.format || '6-well';
      const p = { '24-well': { dna: 0.75, p3k: 1.5, lipo: 2, opti: 125 }, '12-well': { dna: 1.5, p3k: 3, lipo: 3.75, opti: 125 }, '6-well': { dna: 2.5, p3k: 5, lipo: 7.5, opti: 125 }, '10 cm': { dna: 10, p3k: 20, lipo: 20, opti: 500 }, '15 cm': { dna: 20, p3k: 40, lipo: 40, opti: 1000 } }[f];
      return `DNA: ${p.dna} µg + P3000: ${p.p3k} µL + Lipofectamine 3000: ${p.lipo} µL in ${p.opti * 2} µL Opti-MEM`;
    },
    steps: [
      { text: 'Seed cells 18-24 h before transfection. Target 70-90% confluency at time of transfection. Change medium 30 min before transfection.', special: null },
      { text: 'Prepare Tube A: Dilute Lipofectamine 3000 in Opti-MEM (see calculator for volumes). Incubate 5 min at RT.', special: null },
      { text: 'Prepare Tube B: Mix DNA + P3000 Reagent in Opti-MEM (see calculator). Vortex gently.', special: null },
      { text: 'Add Tube B to Tube A (1:1 ratio). Mix gently by pipetting 5×. Incubate 15 min at RT — lipoplexes form.', special: null },
      { text: 'Add lipoplex-containing mixture dropwise to cells. Swirl gently to distribute evenly.', special: null },
      { text: 'Incubate at 37°C, 5% CO₂. Analyze expression 24-72 h post-transfection. Typical peak: 48 h for most proteins.', special: 'temp' },
    ]
  },
  {
    id: 'ni-nta-purification',
    name: 'His-Tag Protein Purification (Ni-NTA)',
    category: 'Protein',
    tags: ['His-tag', 'Ni-NTA', 'protein purification', 'IMAC', 'affinity'],
    steps: [
      { text: 'After bacterial lysis (see Bacterial Cell Lysis protocol), take soluble fraction (supernatant). Add imidazole to 10-20 mM final concentration to reduce non-specific binding.', special: 'ice' },
      { text: 'Equilibrate Ni-NTA resin with 5 column volumes (CV) equilibration buffer (50 mM NaH₂PO₄, 300 mM NaCl, 10-20 mM imidazole, pH 8.0). Keep column at 4°C.', special: 'ice' },
      { text: 'Load lysate onto column by gravity flow or at <1 mL/min with peristaltic pump. Collect flow-through for analysis.', special: 'ice' },
      { text: 'Wash with 10-20 CV wash buffer (50 mM NaH₂PO₄, 300 mM NaCl, 20-50 mM imidazole, pH 8.0). Collect wash fractions. Increasing imidazole in wash removes more contaminants but may elute target if binding is weak.', special: 'ice' },
      { text: 'Elute with 3-5 CV elution buffer (50 mM NaH₂PO₄, 300 mM NaCl, 250-500 mM imidazole, pH 8.0). Collect fractions (0.5-1 mL each). Collect until A280 drops to baseline.', special: 'ice' },
      { text: 'Run SDS-PAGE to identify fractions containing target protein. Pool clean fractions. Dialyze into storage buffer (typically PBS + 10% glycerol) using dialysis cassette or Amicon centrifugal concentrator.', special: null },
      { text: 'Measure final concentration by BCA or Bradford. Aliquot (avoid freeze-thaw) and store at -80°C. Regenerate Ni-NTA resin: strip with 100 mM EDTA → wash → recharge with 100 mM NiSO₄ → re-equilibrate.', special: null },
    ]
  },
  {
    id: 'flow-cytometry',
    name: 'Flow Cytometry — Surface Staining',
    category: 'Cell Biology',
    tags: ['flow cytometry', 'FACS', 'surface staining', 'antibody', 'fluorescence'],
    steps: [
      { text: 'Harvest cells. For adherent cells: trypsinize, neutralize, centrifuge (300×g × 5 min). For suspension: collect directly. Count cells. Use 0.5–2 × 10⁶ cells per staining reaction.', special: null },
      { text: 'Wash cells 1× in FACS buffer (PBS + 2% FBS or 0.5% BSA). Centrifuge 300×g × 5 min at 4°C. Discard supernatant.', special: 'ice' },
      { text: 'Resuspend in 50-100 µL FACS buffer. Add Fc block (e.g., human TruStain FcX or mouse anti-CD16/32) if using human/mouse immune cells. Incubate 10 min on ice.', special: 'ice' },
      { text: 'Add primary antibody (or antibody cocktail) at manufacturer-recommended dilution in 50-100 µL FACS buffer. Incubate 30 min on ice, protected from light.', special: 'ice' },
      { text: 'Wash 2× in FACS buffer (300×g × 5 min, 4°C). If using conjugated primary antibody, proceed to step 6. If unconjugated, add secondary antibody in 50-100 µL FACS buffer, incubate 30 min on ice, then wash 2×.', special: 'ice' },
      { text: 'Add viability dye if needed (e.g., DAPI 1 µg/mL or Live/Dead fixable dye per manufacturer protocol) 5-10 min before acquisition.', special: null },
      { text: 'Resuspend in 200-400 µL FACS buffer. Acquire on flow cytometer. Include single-color and FMO controls for compensation. Gate on scatter first (FSC/SSC), then live cells (viability dye), then cell population of interest.', special: null },
    ]
  },
];

const SPECIAL_STYLES = {
  ice: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', label: '🧊 On Ice' },
  toxic: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: '☠️ Toxic — Gloves Required' },
  warning: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: '⚠️ Caution' },
  'fume hood': { bg: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', label: '🔬 Fume Hood' },
  temp: { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', label: '🌡️ Temperature' },
};

function ProtocolCard({ protocol }) {
  const [open, setOpen] = useState(false);
  const [calcVals, setCalcVals] = useState(
    Object.fromEntries((protocol.calcFields || []).map(f => [f.id, f.default]))
  );

  const calcResult = protocol.calc ? protocol.calc(calcVals) : null;

  return (
    <Card className="border-0 shadow-sm bg-white">
      <button className="w-full text-left p-5 flex items-start justify-between gap-4" onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-slate-800">{protocol.name}</span>
            <Badge className="bg-slate-100 text-slate-600 text-xs">{protocol.category}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {protocol.tags.map(t => <span key={t} className="text-xs text-slate-400">#{t}</span>)}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-5 space-y-4">
          {protocol.calcFields && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-teal-800">Scale calculator</p>
              <div className="flex flex-wrap gap-3">
                {protocol.calcFields.map(f => (
                  <div key={f.id} className="space-y-1">
                    <Label className="text-xs text-teal-700">{f.label}</Label>
                    {f.isSelect ? (
                      <select
                        value={calcVals[f.id]}
                        onChange={e => setCalcVals({ ...calcVals, [f.id]: e.target.value })}
                        className="h-8 w-40 text-sm border border-teal-300 rounded-md px-2 bg-white"
                      >
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input value={calcVals[f.id]} onChange={e => setCalcVals({ ...calcVals, [f.id]: e.target.value })} className="h-8 w-40 text-sm border-teal-300" />
                    )}
                  </div>
                ))}
              </div>
              {calcResult && (
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-teal-200">
                  <FlaskConical className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <p className="text-sm text-teal-800 font-medium">{calcResult}</p>
                </div>
              )}
            </div>
          )}
          <ol className="space-y-2">
            {protocol.steps.map((step, i) => {
              const style = step.special ? SPECIAL_STYLES[step.special] : null;
              return (
                <li key={i} className={`flex gap-3 p-3 rounded-lg border text-sm ${style ? style.bg : 'bg-slate-50 border-slate-100'}`}>
                  <span className="font-bold text-slate-500 w-5 flex-shrink-0">{i + 1}.</span>
                  <div className="flex-1">
                    <span className="text-slate-700">{step.text}</span>
                    {step.param && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(step.param.options).map(([key, val]) => (
                          <span key={key} className="text-xs bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">
                            <span className="text-slate-400">{key}:</span> {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {style && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium self-start flex-shrink-0 ${style.badge}`}>{style.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

export default function ProtocolLibrary() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(PROTOCOLS.map(p => p.category)))];

  const filtered = PROTOCOLS.filter(p => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Protocol Library</h2>
          <p className="text-sm text-slate-500">Standard workflows with scaling calculators and safety notes</p>
        </div>
      </div>

      <Tabs defaultValue="library">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="library">Protocol Library</TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Protocol Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search protocols..." className="pl-9 border-slate-200" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No protocols found</p>
              </div>
            ) : (
              filtered.map(p => <ProtocolCard key={p.id} protocol={p} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card className="border-0 shadow-sm bg-white/80">
            <CardContent className="p-5">
              <ProtocolAIChat />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
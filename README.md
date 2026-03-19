# BiBaBenchBuddy

<a href="https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases/latest" height="20">
<a href="https://img.shields.io/github/downloads/DaphneHoutackers/BiBaBench-Buddy/total?style=for-the-badge&logo=github&label=downloads" height="20">
<a href="https://bi-ba-bench-buddy.vercel.app/">
  <img src="https://img.shields.io/badge/Open-Webapp-BF5FFF?style=for-the-badge&logo=vercel&logoColor=white" height="20" />
</a>
<a href="https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases/latest/download/BiBaBenchBuddy-mac-arm64.dmg">
  <img src="https://img.shields.io/badge/Download-macOS-black?style=for-the-badge&logo=apple&logoColor=white" height="20" />
</a>
<a href="https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases/latest/download/BiBaBenchBuddy-Setup.exe">
  <img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows&logoColor=white" height="20" />
</a>
<a href="https://buymeacoffee.com/daphnewoodpecker">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="20">
</a>

BiBaBenchBuddy is a desktop and web application designed for molecular biology workflows. It provides practical tools for calculations, visualization, and protocol support, helping streamline routine lab work and reduce manual errors.

<img width="800" height="600" alt="Schermafbeelding 2026-03-18 om 16 10 05" src="https://github.com/user-attachments/assets/ec5de3a3-d48f-4f09-a635-cc0b7791d808" />

## Features

- DNA digestion calculator
- Ligation calculator
- Gibson assembly calculator
- PCR setup & optimization tools
- Dilution and concentration calculators
- Gel electrophoresis and western blot simulator
- Buffer library & calculator
- Clean, fast, mobile-friendly interface

## Use & Installation

### 🌐 WebApp [Open webapp ↗](https://bi-ba-bench-buddy.vercel.app/)

The latest version is always active and accessible from any browser via this link:
**[https://bi-ba-bench-buddy.app](https://bi-ba-bench-buddy.vercel.app/)**

### 💻 Desktop Application [![release](https://img.shields.io/github/v/release/DaphneHoutackers/BiBaBench-Buddy)](https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases)

For a standalone experience with native performance:

- **Download:** [![Download for macOS](https://img.shields.io/badge/Download-macOS%20Apple%20Silicon-blue?logo=apple)](https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases/latest/download/BiBaBenchBuddy-mac-arm64.dmg)
- **Windows Version:** [![Download for Windows](https://img.shields.io/badge/Download-Windows-green?logo=windows)](https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases/latest/download/BiBaBenchBuddy-Setup-.exe)
- **All versions:** [Releases overview](https://github.com/DaphneHoutackers/BiBaBench-Buddy/releases)

## Usage

### 1. Setup & Configuration

Before starting your experiments, click the **Settings** icon in the top right:

- **Sync:** Log in with **Email** or **GitHub** to keep your sessions and settings synced across your laptop and web browser.
- **AI Settings:** Paste your API keys (e.g., Google Gemini, OpenAI, or Groq) to unlock the AI Buffer Assistant and smarter protocol generation.
- **Appearance:** Choose from various themes, including _Modern Dark_, _Glass MacOS_, and curated styles like _pretty pink💕_.

![alt text](<Kapture 2026-03-19 at 03.03.31.gif>)

### 2. Navigation & History

- **Sidebar:** The collapsible sidebar tracks your **Session History**. It automatically saves your last 50 tool interactions, so you can restore a complex calculation or a gel map with a single click.
- **Home Grid:** All tools are categorized for quick access. Click the app logo to return home at any time. Or open the sidebar for an overview of all tools and your session history.

### 3. Features

#### 🧬 Calculators (Lab Math)

- **Digestion, Ligation & Gibson**:
  - **Digestion**: Batch process restriction digests with a vast library of NEB and Thermo enzymes.
  - **Ligation**: Calculate optimal vector-to-insert molar ratios for standard ligations.
  - **Gibson Assembly**: Multi-fragment assembly planning with molarity and volume calculations.
- **PCR Calculator**:
  - **PCR Mix**: Calculate mastermixes for multiple samples with different template concentrations. Includes _Gradient Mode_ for annealing temperature optimization and volume suggestions for low-concentration templates.
  - **Ta Calculator**: Advanced annealing temperature prediction using the nearest-neighbor model. Provides Tm, MW, and GC content analysis.
  - **OE-PCR**: Plan Overlap Extension PCRs for site-directed mutagenesis or fragment joining.
  - **Product Sequence**: Automatically generate the final DNA sequence based on your primers and template.
- **Dilution & Protein Concentration**:
  - **Dilution**: Simple or serial dilution calculations with molarity or percentage support.
  - **Protein Concentration**: Accurately determine protein concentration using A280 readings, MW, and extinction coefficients.

#### 🧪 Lab & Visualization

- **Gel & Western Blot Simulator**:
  - **DNA Gel**: Simulate high-fidelity agarose gels. Choose between **Manual Mode** (manually enter band sizes) or **Digest Mode** (paste your DNA sequence and select enzymes to let the app calculate and visualize the fragments automatically). Mark bands for extraction directly on the gel.
  - **Western Blot**: Predict protein migration patterns. Select specific PAGE gel types (Tris-Glycine, Bis-Tris, etc.) and use specialized protein ladders.
- **Plasmid Analyzer**:
  - **Map Visualization**: View circular or linear plasmid maps with auto-detection of common features and ORFs (Open Reading Frames).
  - **Sequence Analysis**: Search for specific motifs, restriction sites, and translation frames.
- **Image Annotator (BETA)**:
  - Upload your own gel or blot images. Add professional annotations, arrows, and lane labels. Features custom ladder overlays and batch-styling for figure preparation.

#### 🤖 Protocols & AI

- **AI Buffer Assistant**: A conversational AI optimized for lab chemistry. Describe the buffer you need (e.g., "1X TAE with 10mM EDTA"), and it will generate a recipe you can save to your history.
- **Protocol Library**: A searchable database of standard molecular biology protocols that can be customized and exported.
- **General AI Assistant**: Available via the top-bar icon to answer lab-related questions or explain tool functionalities.

---

## ⚠️ Known Issues

The following issues are known:

- **Ta Calculator:** The Annealing Temperature (Ta) logic is currently being refined and may not be 100% accurate for high-GC or complex primer pairs.
- **Image Annotator:** This tool is in active beta. While basic labeling and exporting work, some advanced selection and scaling features may still behave unexpectedly.
- **Sequence Analyzer:** The feature labeling is not very nicely visualized yet.

---

## 📄 Development

If you wish to run this locally:

1. `npm install`
2. `npm run dev` (Web) or `npm run app:dev` (Desktop)

## ☕ Support

If you like this app, feel free to buy me a coffee :)

<a href="https://buymeacoffee.com/daphnewoodpecker" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="50">
</a>

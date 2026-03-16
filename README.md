# BiBaBench-Buddy (LabCalc)

**BiBaBench-Buddy** is a comprehensive suite of lab tools designed to save time and improve accuracy for molecular biologists. From buffer calculations to gel simulations and AI-assisted protocol generation.

## 🚀 Access the App

### 🌐 Web Application (Recommended)
The latest version is always available online:
**[https://bi-ba-bench-buddy.vercel.app/](https://bi-ba-bench-buddy.vercel.app/)**

### 💻 Desktop Application
For a standalone experience, you can download the desktop version:
- **Mac:** Find the `.dmg` installer in the [`release/`](./release) folder.
- **Windows:** Coming soon (check GitHub Actions for latest builds).

---

## ✨ Features
- **Tool History Sidebar:** Your last 50 sessions are automatically saved and restorable with one click.
- **AI Buffer Assistant:** Chat with AI to design buffer compositions and save them directly to your recipes.
- **Restriction Digest:** Support for single/double/batch digests with NEB/FastDigest/HF enzymes.
- **Gel & Western Blot Simulator:** Visualize DNA and protein migration patterns.
- **Image Annotator:** Professional-grade labeling for your gel images and blots.
- **Calculators:** PCR, Ligation, Gibson Assembly, Dilution, Protein Concentration, and more.

---

## 🛠 Local Development

### Prerequisites
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your API keys:
   ```
   VITE_AI_API_KEY=your_key_here
   ```

### Running the App
- **Web (Dev):** `npm run dev`
- **Desktop (Dev):** `npm run app:dev`

### Building for Production
- **Web:** `npm run build`
- **Desktop:** `npm run app:build`

---

## 📄 Support
If you encounter any issues or have feature requests, please open an issue in this repository.

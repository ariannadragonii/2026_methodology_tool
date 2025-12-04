# A Model-Driven Methodology for Designing Data-Intensive Architectures

This repository contains the replication package and the supporting tool for the paper **"A Model-Driven Methodology for Designing Data-Intensive Architectures"**, submitted to the **2026 International Conference on Software Architecture (ICSA 2026)**.

The repository provides all the necessary artifacts to replicate the study, including the source code of the proposed tool, the datasets used for evaluation, and high-resolution versions of the figures presented in the paper.

## Repository Structure

The repository is organized as follows:

- **`tool/`**: Contains the source code of the web-based tool implementing the methodology.
  - **`backend/`**: Python (Flask) server for graph analysis and architecture generation.
  - **`frontend/`**: React application for the visual modeling interface.
- **`evaluation/`**: Contains the artifacts used to answer the Research Questions (RQs):
  - **RQ1**: JSON files representing the industrial scenarios used to validate the methodology.
  - **RQ2**: Raw data and results from the practitioner survey.
- **`paper_figures/`**: Contains supplementary material, such as high-resolution figures (UML profiles, generated architectures) referenced in the article.

## Getting Started with the Tool

The tool allows users to model data flow scenarios and automatically generate candidate data-intensive architectures.

### Prerequisites
- **Python 3.8+**
- **Node.js v14+** & **npm**

### Installation & Execution

1. **Start the Backend:**
   ```bash
   cd tool/backend
   pip install -r requirements.txt
   python server.py
   ```
   The server runs at `http://127.0.0.1:5001`.

2. **Start the Frontend:**
   Open a new terminal and run:
   ```bash
   cd tool/frontend
   npm install
   npm start
   ```
   The application will open at `http://localhost:3000`.

For more detailed documentation, please refer to the [Tool README](tool/README.md).

## Replication Instructions

### Replicating RQ1 (Industrial Scenarios)
To replicate the results for RQ1:
1. Launch the tool.
2. Import the scenario JSON files located in `evaluation/`.
3. Run the analysis to view the generated candidate architectures and cost estimates.

### Replicating RQ2 (User Study)
The `evaluation/` folder contains:
- The questionnaire used for the survey.
- Anonymized responses from participants.
- Analysis scripts or spreadsheets summarizing the results.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Note: This repository is anonymized for double-blind review.*

# A Model-Based Methodology for Designing Data-Intensive Architectures

This repository contains the replication package and the supporting tool for the paper **"A Model-Based Methodology for Designing Data-Intensive Architectures"** submitted to the **2026 European Conference on Software Architecture (ECSA 2026)**.

The repository provides all the necessary artifacts to replicate the study, including the source code of the proposed tool, the datasets used for evaluation, and high-resolution versions of the figures presented in the paper.

## Repository Structure

The repository is organized as follows:

- **`tool/`**: Contains the source code of the web-based tool implementing the methodology.
  - **`backend/`**: Python (Flask) server for graph analysis and architecture generation.
  - **`frontend/`**: React application for the visual modeling interface.
- **`evaluation/`**: Contains the artifacts used to answer the Research Questions (RQs):
  - **RQ1**: JSON files representing the industrial scenarios used to validate the methodology.
  - **RQ2**: Raw data and results from the practitioner survey.
- **`paper_figures/`**: Contains supplementary material, such as high-resolution figures referenced in the article.

---

## The Tool

The tool provided in this repository is the reference implementation of the methodology. It provides a web-based environment where software architects can model scenarios, simulate different load conditions, and automatically generate candidate architectures based on a rigorous cost analysis.

### Key Features

- **Visual Graph Editor**: Interactive drag-and-drop interface to model data flows (Producers, Consumers, Processing Nodes, Merge Nodes).
- **3D Visualization**: Interactive visualization of the cost space to explore trade-offs between different architectural decisions.
- **Architecture Generation**: Automatic derivation of candidate architectures (State-Centric, Data-Centric Batch, Data-Centric Stream).

### System Overview

The tool is built as a web application with a decoupled architecture:
- **Frontend (`/tool/frontend`)**: A **React** application (TypeScript) that handles the UI, graph modeling, and result visualization.
- **Backend (`/tool/backend`)**: A **Python Flask** server that exposes REST APIs to process the graph models, execute the cost formulas, and return the optimal architectural configurations.

---

## Installation & Setup

### Prerequisites
- **Python 3.8+**
- **Node.js v14+** & **npm**

### 1. Backend Setup (Python)

The backend handles the core logic.

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd tool/backend
   ```

2. Create and activate a virtual environment (recommended):
   ```bash
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate

   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the server:
   ```bash
   python server.py
   ```
   The API will be available at `http://127.0.0.1:5001`.

### 2. Frontend Setup (React)

The frontend provides the user interface.

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd tool/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   The application will open automatically at `http://localhost:3000`.

---

## Usage Guide

1. **Model the Scenario**:
   - Use the **Graph Editor** to add nodes (Producers, Consumers, etc.) via the sidebar.
   - Connect nodes to define the data flow.
   - **Double-click** on nodes or edges to configure parameters (e.g., data volume, period, selectivity).
   - Alternatively, you can **upload an existing graph** in JSON format using the upload button in the sidebar.

2. **Run Analysis**:
   - Click the **"Elaborate Graph"** button in the sidebar.
   - The tool sends the model to the backend for processing.
   - You will be redirected to the **Results** page, where you can explore the cost analysis.

3. **Generate Architectures**:
   - From the Results page, click **"Generate Candidate Architectures"**.
   - This will produce the final architectural diagrams based on the analysis.

---

## Replication Instructions

### Replicating RQ1 (Industrial Scenarios)
To replicate the results for RQ1:
1. Launch the tool (Backend + Frontend).
2. In the frontend, use the **"Upload JSON"** button.
3. Select one of the scenario files located in the `evaluation/` folder (e.g., `RQ1_CompanyA_SDL.json`).
4. Click **"Elaborate Graph"** to view the generated candidate architectures and cost estimates.

### Replicating RQ2 (User Study)
The `evaluation/` folder contains:
- The questionnaire used for the survey.
- Anonymized responses from participants (`RQ2_results.csv`).

---
*Note: This repository is anonymized for double-blind review.*

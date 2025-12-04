# 🛠️ Data-Intensive Architecture Design Tool

This tool is the reference implementation of the **Model-Driven Methodology for
Designing Data-Intensive Architectures** presented at **ICSA 2026**.

It provides a web-based environment where software architects can model
scenarios, simulate different load conditions, and automatically generate
optimal architectural candidates based on a rigorous cost analysis.

## Key Features

- **Visual Graph Editor**: Interactive drag-and-drop interface to model data
  flows (Producers, Consumers, Processing Nodes, Merge Nodes).
- **3D Visualization**: Interactive visualization of the cost space to explore
  trade-offs between different architectural decisions.
- **Architecture Generation**: Automatic derivation of candidate architectures
  (State-Centric, Data-Centric Batch, Data-Centric Stream).


## 🏗️ System Overview

The tool is built as a web application with a decoupled architecture:

- **Frontend (`/frontend`)**: A **React** application (TypeScript) that handles
  the UI, graph modeling (using custom node components), and result
  visualization.
- **Backend (`/backend`)**: A **Python Flask** server that exposes REST APIs to
  process the graph models, execute the cost formulas, and return the optimal
  architectural configurations.

## 🚀 Installation & Setup

### Prerequisites
- **Python 3.8+**
- **Node.js v14+** & **npm**

### 1. Backend Setup (Python)

The backend handles the core logic.

1. Navigate to the backend folder:
   ```bash
   cd backend
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
   cd frontend
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

## Usage Guide

1. **Model the Scenario**:
   - Use the **Graph Editor** to drag nodes onto the canvas.
   - Connect nodes to define the data flow.
   - Click on nodes/edges to configure parameters (e.g., data volume, frequency,
     selectivity).
   - Alternatively, you can **upload an existing graph** in JSON format using
     the upload button.

2. **Run Analysis**:
   - Click the **"Elaborate Graph"** button.
   - The tool sends the model to the backend for processing.

3. **Explore Results**:
   - View the **Cost Analysis** of single nodes to see how different cost
     coefficients affect the architectural choice.
   - Switch to the **Candidate Architectures** view to see the graphs for the
      optimal solutions.

## 📂 Project Structure

- **`backend/`**
  - `server.py`: Main entry point for the API.
  - `analyze_scenario.py`: Core logic for graph traversal and cost calculation.
  - `candidate_architectures.py`: Logic for generating architectural candidates.
- **`frontend/src/`**
  - `GraphEditor.tsx`: Main component for the modeling canvas.
  - `Results.tsx`: Component for displaying analysis results.
  - `CandidateArchitectures.tsx`: Component for visualizing generated
    architectures.


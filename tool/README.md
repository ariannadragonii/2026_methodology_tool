# Data-Intensive Architecture Design Tool

This tool implements the Model-Driven Methodology for designing data-intensive architectures described in the ICSA2026 paper. It allows users to model data flow scenarios, analyze computational and retrieval costs, and identify the optimal architectural patterns (State-Centric vs. Data-Centric).

The project is divided into two main components:
- **Backend**: A Python/Flask server that handles the logic for graph analysis, cost calculation, and architecture generation.
- **Frontend**: A React-based web application that provides a visual interface for modeling scenarios and viewing results.

## Prerequisites

Before running the tool, ensure you have the following installed:
- **Python 3.8+**
- **Node.js** (v14 or higher) and **npm**

---

## 1. Setting up the Backend

The backend performs the heavy lifting of analyzing the graph and calculating costs.

1. Navigate to the backend directory:
   ```bash
   cd tool/backend
   ```

2. (Optional but recommended) Create and activate a virtual environment:
   ```bash
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate

   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask server:
   ```bash
   python server.py
   ```
   The server will start running at `http://127.0.0.1:5001`.

---

## 2. Setting up the Frontend

The frontend provides the graphical user interface.

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd tool/frontend
   ```

2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React application:
   ```bash
   npm start
   ```
   The application should automatically open in your browser at `http://localhost:3000`.

---

## Usage Guide

1. **Define Scenario**: Use the sidebar to add nodes (Producers, Consumers, Processing, Merge) to the canvas. Connect them to define the data flow.
2. **Configure Nodes**: Click on nodes or edges to set parameters (e.g., data frequency, size, cardinality).
3. **Elaborate Graph**: Click the "Elaborate Graph" button. The tool will send the model to the backend.
4. **Analyze Results**: The tool will display a 3D cost surface or 2D cross-sections, showing which architectural pattern (State-Centric, Data-Centric Batch, or Data-Centric Stream) is optimal for specific cost coefficients ($K_{sc}$, $K_{dc}$, etc.).
5. **Generate Architecture**: Based on the analysis, you can generate the final candidate architecture.

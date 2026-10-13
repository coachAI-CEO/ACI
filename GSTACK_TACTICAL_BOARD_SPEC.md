
Engineering Specification: Decoupled Spatial Architecture for AI Tactical Board & Drill Builder
1. Executive Summary & Objective
The goal of this specification is to refactor the chat-to-drawing engine for soccer tactics, rondos, and drill creations.
Generating raw canvas shapes and absolute (x, y) coordinates directly from LLM output leads to coordinate hallucinations, out-of-bounds entities, overlapping players, and broken movement vectors. This document establishes a Decoupled Spatial Architecture. The LLM acts strictly as a symbolic intent parser, while a deterministic layout solver computes visual geometry and hands solved positions to a parametric canvas state engine.
2. Framework Comparison: Direct Generation vs. Decoupled Architecture
Dimension	Current Framework (Direct LLM Generation)	Proposed Decoupled Spatial Architecture
LLM Responsibility	Outputs raw pixel coordinates, SVG paths, and visual shapes directly.	Outputs abstract symbolic DSL payloads and relational predicates.
Spatial Engine	Probabilistic token prediction (unreliable math).	Deterministic layout solver (Kiwi.js, D3-force, or Shapely).
Canvas Integration	Re-renders static or unconstrained visual elements.	Updates a parametric vector node graph (tldraw or React SVG canvas).
Scenario Handling	Complete canvas redraw per prompt; loses entity identities.	State-machine temporal deltas ([Frame 0, Frame 1, Frame 2]).
Token Cost & Speed	Verbose coordinate JSON payloads (>2000\text{ tokens} per request).	Concise symbolic DSL (<300\text{ tokens} per request).
Editing Loop	Static unidirectional chat-to-image output.	Bi-directional synchronization: manual canvas edits update the JSON state array.
3. Four-Layer System Execution Flow
The architecture processes tactical requests through four sequential layers:
1. Layer 1: Intent & Symbolic Extraction (LLM) ⚬ Ingests the user prompt and current pitch state. ⚬ Converts natural language into a structured domain-specific language (DSL) containing grid requirements, equipment lists, and symbolic player placements.
2. Layer 2: Deterministic Spatial Solving (Layout Engine) ⚬ Receives the symbolic DSL payload. ⚬ Maps relative positions (e.g., grid_corner_north) to exact pitch metrics (105\text{m} \times 68\text{m}). ⚬ Executes collision resolution algorithms (D3-force) to push overlapping player icons apart and route passing vectors cleanly.
3. Layer 3: Parametric Vector Rendering (Canvas Engine) ⚬ Loads solved metric coordinates into an SVG/HTML5 canvas state store (tldraw or custom React engine). ⚬ Renders interactive player circles, directional facing vectors, equipment icons, and B-spline movement curves.
4. Layer 4: Bi-Directional Delta Synchronization ⚬ Captures manual drag-and-drop adjustments on the canvas and updates the underlying JSON state array. ⚬ Submits only mutated attributes (state_delta) back to the LLM during follow-up chat prompts.
4. Technical Schemas & Data Contracts
Contract A: LLM Symbolic Output Schema (Input to Layout Solver)json
{
"$schema": "http://json-schema.org/draft-07/schema#",
"title": "LLMSymbolicTacticalDSL",
"type": "object",
"properties": {
"activity_type": {
"type": "string",
"enum": ["rondo", "match_scenario", "technical_exercise", "scrimmage"]
},
"grid": {
"type": "object",
"properties": {
"dimensions_meters": {
"type": "array",
"items": { "type": "number" },
"minItems": 2,
"maxItems": 2
},
"anchor_location": { "type": "string", "default": "center_circle" }
},
"required": ["dimensions_meters"]
},
"entities": {
"type": "array",
"items": {
"type": "object",
"properties": {
"id": { "type": "string" },
"team": { "type": "string", "enum": ["attacking", "defending", "neutral"] },
"relative_position": { "type": "string" },
"role": { "type": "string" }
},
"required": ["id", "team", "relative_position"]
}
},
"equipment": {
"type": "array",
"items": {
"type": "object",
"properties": {
"type": { "type": "string", "enum": ["disc_cone", "tall_cone", "mini_goal", "dummy"] },
"placement": { "type": "string" },
"quantity": { "type": "integer" }
},
"required": ["type", "placement", "quantity"]
}
},
"actions": {
"type": "array",
"items": {
"type": "object",
"properties": {
"type": { "type": "string", "enum": ["pass", "dribble", "run", "press"] },
"from_id": { "type": "string" },
"to_id": { "type": "string" },
"style": { "type": "string", "enum": ["solid", "dashed", "curved"] }
},
"required": ["type", "from_id", "to_id"]
}
}
},
"required": ["activity_type", "grid", "entities", "equipment", "actions"]
}

### Contract B: Solved Canvas Frame Payload (Input to Canvas Store)

```json
{
  "$schema": "[http://json-schema.org/draft-07/schema#](http://json-schema.org/draft-07/schema#)",
  "title": "SolvedCanvasStatePayload",
  "type": "object",
  "properties": {
    "pitch_dimensions": {
      "type": "object",
      "properties": {
        "length": { "type": "number", "default": 105.0 },
        "width": { "type": "number", "default": 68.0 }
      }
    },
    "active_frame_index": { "type": "integer", "default": 0 },
    "frames": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "frame_id": { "type": "string" },
          "description": { "type": "string" },
          "players": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "x": { "type": "number" },
                "y": { "type": "number" },
                "team": { "type": "string" },
                "label": { "type": "string" }
              },
              "required": ["id", "x", "y", "team"]
            }
          },
          "equipment": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "type": { "type": "string" },
                "x": { "type": "number" },
                "y": { "type": "number" },
                "color": { "type": "string" }
              },
              "required": ["id", "type", "x", "y"]
            }
          },
          "annotations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": { "type": "string" },
                "start_point": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
                "end_point": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
                "curvature": { "type": "number" }
              },
              "required": ["type", "start_point", "end_point"]
            }
          }
        },
        "required": ["frame_id", "players", "equipment", "annotations"]
      }
    }
  },
  "required": ["pitch_dimensions", "active_frame_index", "frames"]
}

5. gstack Skill Execution Workflow
Run these gstack slash commands sequentially to implement and verify this specification:
1. /office-hours Stress-test the decoupled system against user requirements and validate the symbolic translation strategy.
2. /spec Ingest this document to construct an executable engineering task backlog.
3. /plan-eng-review Lock down technical API contracts, state synchronization pipelines, and boundary test cases.
4. /plan-design-review Establish rendering rules, contrast palettes, and responsive canvas sizing.
5. /qa Execute automated browser interactions to verify player drag-and-drop mechanics, canvas frame stepping, and chat responsiveness.


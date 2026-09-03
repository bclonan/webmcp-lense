# Lens demo video script

Target runtime: 2:50. 386 spoken words, about 136 words per minute. Use the fixture desktop, fictional data and an agent connected to the current Lens page. Do not cut the primary workflow.

Generated from apps/web/src/content/demo-video-script.json. Edit that file, then run node scripts/generate-demo-script.mjs.

## 0:00–0:15 | Problem and thesis

Screen action: Show /hackathon, then the Workspace and its fixture label.

Narration:

> A screen can be easy for a person and ambiguous for an agent. I built Lens to make actions explicit, reviewable, and visible. The person and the agent work in the same browser session.

WebMCP tools: None in this segment.

Expected visible result: Lens hero, Workspace, 19 tools and the event timeline.

## 0:15–0:35 | Application and goal

Screen action: Click New session, then Enable demo control. Show the Paint goal and current observation. Keep the agent pane beside Workspace.

Narration:

> This is the local demo desktop. No API key or native installation is needed. I enable control, then ask for a house and sun in Paint. The fixture label matters: this is a deterministic demonstration of the runtime, not a claim that Lens understands arbitrary desktop pixels.

WebMCP tools: `screen_get_context`

Expected visible result: Fixture observation; authorized demo with an empty desktop.

## 0:35–1:45 | Uninterrupted primary workflow

Screen action: Ask the agent to start recording, run the Paint goal, inspect goal_status, then read screen_get_context and session_get_events. Do not cut away or speed up the workflow. Expand a pointer event and its receipt while narrating.

Narration:

> The agent starts a recording of Lens actions and submits the Paint goal as a structured call. Lens returns an accepted goal ID. Accepted does not mean completed. We follow the current goal with the status tool while the same Workspace shows each transition. The runtime opens Paint, resolves its canvas, and draws four pointer paths. Those strokes are visible here. Each action passes through the policy check, bridge response, observation, and verification. If an action needs approval, the person sees a card in this panel. No tool can approve it for them. The event timeline explains what happened without asking us to infer success from a button click. Now the goal is complete. A fresh fixture observation reports the house and sun. The events retain the commands and their results. A failure would stop the remaining steps. Lens would not silently retry a mouse click or type the same text twice.

WebMCP tools: `workflow_start_recording`, `goal_start`, `goal_status`, `screen_get_context`, `session_get_events`

Expected visible result: Paint house and sun, four paths, completed status, recorded events.

## 1:45–2:15 | Chain and shared state

Screen action: Save the settled recording with workflow_stop_recording named House with a sun. Pass its returned data.id to capability_export. Click Show workflows and open the new cartridge; show its JSON.

Narration:

> Next, we turn that run into a reusable workflow. The agent ends the recording and names it House with a sun. The saved cartridge appears immediately in Workspace because the tool and the interface use the same service and state. Its returned ID becomes the argument to the export tool. That returns portable JSON. I still choose whether to download a file, edit the steps, or run them again.

WebMCP tools: `workflow_stop_recording`, `capability_export`

Expected visible result: Saved cartridge in Workspace and matching structured JSON.

## 2:15–2:35 | Compare approaches

Screen action: Open /webmcp and advance the isolated comparison example. Point out the illustrative label and the unchanged real workspace.

Narration:

> A screenshot agent has to locate controls and infer their meaning. Lens exposes names, schemas, and results instead. This comparison is illustrative, not a speed benchmark. The tool contract survives presentation changes. Desktop coordinates and live visual interpretation still need care; WebMCP does not remove those limits.

WebMCP tools: None in this segment.

Expected visible result: Original comparison cards and explicitly illustrative operation counts.

## 2:35–2:50 | Architecture and close

Screen action: Open /hackathon architecture and repository link. Keep the public demo and source URLs visible.

Narration:

> Lens uses Vue, Pinia, strict schemas, and IndexedDB. Netlify hosts the app; an optional Rust companion handles reviewed native input. The source and setup instructions are linked here. My aim is simple: inspect, act, and verify together.

WebMCP tools: None in this segment.

Expected visible result: Architecture, source link and live demo link.

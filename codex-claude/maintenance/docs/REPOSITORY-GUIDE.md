# Repository reference

Start at the [edition chooser and one-pass setup](../../../README.md). The versioned [shared package](../../../factory/README.md) supplies the dashboard, installer and owner protocol; the three edition folders supply routing-specific setup prompts and guides.

The tools here are optional offline metadata validators and a bounded Claude connection checker. They are not installed into apps and do not dispatch models, authenticate dashboard commands or merge work. See [maintenance commands](../README.md).

Use Node.js 22+, Git and only the selected edition's actual provider tools/accounts. No Python dashboard server is required. Check worker access in its real runtime environment, not merely an external terminal. Offline fixtures do not prove live identity, browser fidelity or a completed app.

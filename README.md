# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# Change log

## [0.2.2] - 2025-09-13
- Feature: Added mute/unmute button for each video, set mute by default
- UI: Changed the interface and made buttons in groups not just one after the other

## [0.2.1] - 2025-09-13
- Feature: Added delta bar
- UX: users can easily know if they are faster or slower while watching the video without looking at the delta number itslef

## [0.2] - 2025-09-12
- Feature: Added refrence mode which allows users to manually set anchor pionts during their lap
- Optimization: created timeFormatter.js to reduce duplicate code
- UX: added overlay feature that allows the videos to be overlayed as it made it easier to add the anchor points
- UI: added controls for the user to +- by 1 frame or 0.1s

## [0.1.2] - 2025-09-09
- Optimization: Play back time is now smooth and increases by 0.001ms rather than chunks
- UX: Made the live delta and final gap to 3 decimal places for consistancy
- UI: Made the live delta and final gap white if at 0
- Bug: Fixed pause and play synchronization issue
- Feature: Added FPS as part of the meta data using mediainfo

## [0.1.1] - 2025-09-09
- Build: Changed port to 8080

## [0.1] - 2025-09-09
- Initizalied the React Web app with basic functions
- Feature: User can upload videos and view meta data
- Feature: User can play pause and reset the previewed video
- Feature: The lap time for both laps have been pulled, and the final gap is calculated
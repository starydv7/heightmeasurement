# Child Growth Measurement App (Expo + AI)

A mobile application built using React Native (Expo) to estimate and track a child’s height using image-based measurement techniques.

Originally developed in collaboration with AIIMS (All India Institute of Medical Sciences) under the guidance of Dr. Rakesh Lodha, Pediatric Department (Mother & Child Care), this application aims to digitize and simplify child growth monitoring.

---

## Overview

This app is designed to help health workers, parents, and doctors measure and track a child’s physical growth (height, weight, etc.) in a simple, accessible, and scalable way.

It leverages image-based estimation techniques combined with structured health tracking to support better decision-making in child healthcare.

---

## Problem Statement

- Manual growth tracking is inconsistent and error-prone  
- Rural and semi-urban areas lack proper measurement tools  
- No centralized system for tracking child growth over time  
- Early signs of malnutrition or growth issues often go unnoticed  

---

## Solution

This app provides:

[+] Height estimation using image + reference object  
[+] Growth tracking over time  
[+] Child profile management  
[+] Basic health insights (expandable)  
[+] Offline-friendly architecture (future scope)  

---

## Core Features

### 1. Height Measurement
- Uses image-based ratio calculation  
- Requires a reference object of known height  
- Lightweight and device-friendly approach  

### 2. Growth Tracking
- Store height records over time  
- View progress trends  

### 3. Modular Architecture
- Clean and scalable folder structure  
- Separation of concerns for easy expansion  

---

## Tech Stack

- Frontend: React Native (Expo)  
- Language: TypeScript  
- Architecture: Modular (src-based structure)  
- Build System: Expo Application Services (EAS)  

---

## Project Structure
.
├── App.tsx
├── src/
│ ├── screens/ # Screen-level UI
│ ├── components/ # Reusable components
│ ├── services/ # Business logic (height calculation, etc.)
│ ├── utils/ # Helper functions
│ ├── types/ # TypeScript models
│ └── constants/ # App constants and themes
├── app.json # Expo configuration
├── eas.json # Build profiles

## Installation and Running
npm install
npm run start


---

## Build Commands

### Android
npm run build:android:preview
npm run build:android:production


### iOS---Currently not available for this version will later available



---

## Future Enhancements

[+] Weight tracking integration  
[+] WHO-based growth charts  
[+] AI-based growth analysis and alerts  
[+] Cloud sync and multi-device access  
[+] Doctor dashboard for monitoring multiple children  
[+] Offline-first support for rural environments  

---

## Impact Vision

This project aims to evolve into a Child Growth Intelligence System that can:

- Help detect early malnutrition  
- Support ASHA workers and healthcare staff  
- Improve pediatric care in underserved regions  
- Provide scalable digital health infrastructure  

---

## Acknowledgment

Developed with inspiration and guidance from:

- Dr. Rakesh Lodha (AIIMS-Delhi)-(Child and Mother) 
- Pediatric Department, AIIMS (All India Institute of Medical Sciences)  

---

## Author

Pawan Yadav  
Full Stack Developer (MERN + Mobile)

---

## Contribute

Contributions, suggestions, and improvements are welcome.  
Feel free to fork the repository and raise a pull request.

---

## License

MIT License

"use client";
import React, { createContext, useContext } from "react";

export const LandingPageDataContext = createContext<any>({
    programs: [],
    classes: [],
    displayCoaches: [],
    daysInfo: [],
    isEditor: false,
});

export const useLandingData = () => useContext(LandingPageDataContext);

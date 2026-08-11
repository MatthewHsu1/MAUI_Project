// src/features/dataGrid/useGridDispatch.ts
import { useDispatch } from "react-redux";
import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

/** Dispatch that accepts both plain actions and thunks, without importing the
 *  app store's typed dispatch (keeps the engine reusable across stores). */
export const useGridDispatch = () => useDispatch<ThunkDispatch<unknown, unknown, UnknownAction>>();

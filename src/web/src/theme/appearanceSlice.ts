import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Appearance = "light" | "dark";

export interface AppearanceState {
  appearance: Appearance;
}

const initialState: AppearanceState = { appearance: "light" };

const appearanceSlice = createSlice({
  name: "appearance",
  initialState,
  reducers: {
    setAppearance(state, action: PayloadAction<Appearance>) {
      state.appearance = action.payload;
    },
  },
});

export const { setAppearance } = appearanceSlice.actions;

export default appearanceSlice.reducer;

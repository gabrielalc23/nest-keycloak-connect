export enum RoleMerge {
  /**
   * Overrides roles if defined on both controller and handler.
   */
  OVERRIDE,
  /**
   * Merges roles from both controller and handler.
   */
  ALL,
}

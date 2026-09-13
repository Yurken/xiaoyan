/** @param {{ config: Record<string, unknown> }} params */
module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PROJECT_ID;
  if (typeof projectId !== "string" || projectId.length === 0) {
    return config;
  }

  const extra =
    config.extra && typeof config.extra === "object" && !Array.isArray(config.extra)
      ? config.extra
      : {};
  const eas =
    extra.eas && typeof extra.eas === "object" && !Array.isArray(extra.eas) ? extra.eas : {};

  return {
    ...config,
    extra: {
      ...extra,
      eas: {
        ...eas,
        projectId,
      },
    },
  };
};

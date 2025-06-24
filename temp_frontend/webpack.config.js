// Custom webpack configuration to override react-scripts defaults
module.exports = {
  // This file is used to customize webpack configuration
  // It will be merged with the configuration from react-scripts
  devServer: {
    // Use setupMiddlewares instead of the deprecated options
    setupMiddlewares: (middlewares, devServer) => {
      // You can add your custom middlewares here
      return middlewares;
    },
  },
};
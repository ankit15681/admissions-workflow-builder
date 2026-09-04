const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";
  return {
    entry: path.resolve(__dirname, "src", "index.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isProd ? "[name].[contenthash].js" : "[name].js",
      publicPath: "/",
      clean: true,
    },
    devtool: isProd ? "source-map" : "eval-source-map",
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      modules: [path.resolve(__dirname, "src"), "node_modules"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: { loader: "ts-loader", options: { transpileOnly: true } },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "public", "index.html"),
      }),
    ],
    devServer: {
      port: 5173,
      historyApiFallback: true,
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:4000",
        },
      ],
    },
  };
};

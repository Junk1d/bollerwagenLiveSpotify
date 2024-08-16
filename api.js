import fs from "fs";
import axios from "axios";
import { Buffer } from "buffer";

let OAuthSp;
let serialize = function (obj) {
  var str = [];
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  }
  return str.join("&");
};
let dataSp = JSON.parse(fs.readFileSync("./spotify.json", "utf8"));
let api = axios.create({
  baseURL: "https://api.spotify.com/v1",
});
api.interceptors.request.use(
  (config) => {
    if (OAuthSp) {
      config.headers.Authorization = "Bearer " + OAuthSp;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const str =
          (await process.env.CLIENT_ID_SPOTIFY) +
          ":" +
          (await process.env.CLIENT_SECRET_SPOTIFY);
        const buff = await Buffer.from(str, "utf-8");
        const base64 = await buff.toString("base64");
        const responseRefesh = await axios.post(
          "https://accounts.spotify.com/api/token",
          await serialize({
            refresh_token: dataSp.refresh_token,
            grant_type: "refresh_token",
          }),
          {
            headers: {
              Authorization: "Basic " + base64,
            },
          }
        );
        // fs.writeFileSync(
        //   "./spotify.json",
        //   JSON.stringify({
        //     refresh_token: responseRefesh.data.refresh_token,
        //   })
        // );
        dataSp.refresh_token = responseRefesh.data.refresh_token;
        OAuthSp = responseRefesh.data.access_token;
        originalRequest.headers.Authorization =
          "Bearer " + responseRefesh.data.access_token;
        return api(originalRequest);
      } catch (error) {
        console.log(error.code);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

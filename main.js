import fetch from "node-fetch";
import axios from "axios";
// import open from "open";
import url from "url";
import http from "http";
import "dotenv/config";
import fs from "fs";
import { Buffer } from "buffer";
import api from "./api.js";

var reqUrl;
var state;
var userID;
var data;
// var username;
var dataSp;
var reqUrlSp;
var expires_at;
let OAuthSp;
// var OAuthTw;
// var OAuRefreshTokenSp;

let radiobollerwagen =
  "https://www.ffn.de/fileadmin/content/playlist-xml/radiobollerwagen.json";
state = makeid(20);
let serialize = function (obj) {
  var str = [];
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  }
  return str.join("&");
};

// StartUpSpotify();
async function StartUpSpotify() {
  try {
    dataSp = JSON.parse(fs.readFileSync("./spotify.json", "utf8"));
    if (dataSp.refresh_token == "INITIAL_REFRESH_TOKEN") {
      TokenSpotify();
    } else {
      if (await refeshTokenSp()) {
        Main();
      } else TokenSpotify();
    }
  } catch (err) {
    if (err.code == "ENOENT") {
      console.error(err.code);
      TokenSpotify();
    }
  }
}
async function refeshTokenSp() {
  const str =
    (await process.env.CLIENT_ID_SPOTIFY) +
    ":" +
    (await process.env.CLIENT_SECRET_SPOTIFY);
  const buff = await Buffer.from(str, "utf-8");
  const base64 = await buff.toString("base64");
  const responseRefesh = await axios
    .post(
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
    )
    .catch((err) => {
      console.log(err);
    });

  if (responseRefesh.status == 200) {
    var d = new Date();
    expires_at = d.getTime + responseRefesh.data.expires_in * 1000;
    OAuthSp = responseRefesh.data.access_token;
    return true;
  } else return false;
}

// TokenSpotify();

async function TokenSpotify() {
  state = makeid(20);
  // console.log(state);
  open(
    `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.CLIENT_ID_SPOTIFY}` +
      "&redirect_uri=http://localhost:3000&" +
      `state=${state}` +
      "&scope=user-modify-playback-state playlist-modify-private playlist-modify-public"
  );

  const server = await http
    .createServer(async function (req, res) {
      res.writeHeader(200, { "Content-Type": "text/html" });
      res.write("");

      await setTimeout(async function () {
        reqUrlSp = await url.parse(req.url, true).query;
        if (state == reqUrlSp.state) {
          // res.writeHeader(200, {
          //     "Content-Type": "text/html",
          // });
          res.write("<script>close()</script>");
          res.end();
          server.close();

          SpCodeToToken(reqUrlSp.code);
        }
      }, 5000);
    })
    .listen(3000);
}

async function CheckExpired() {
  var d = new Date();
  var t = d.getTime;
  t = t - 60000;
  if (t >= expires_at) {
    refeshTokenSp();
    return true;
  } else return false;
}

async function SpCodeToToken(Code) {
  const str =
    (await process.env.CLIENT_ID_SPOTIFY) +
    ":" +
    (await process.env.CLIENT_SECRET_SPOTIFY);
  const buff = await Buffer.from(str, "utf-8");
  const base64 = await buff.toString("base64");
  const responseTokenSp = await axios
    .post(
      "https://accounts.spotify.com/api/token",
      serialize({
        code: Code,
        redirect_uri: "http://localhost:3000",
        grant_type: "authorization_code",
      }),
      {
        headers: {
          Authorization: "Basic " + base64,
        },
      }
    )
    .catch((err) => {
      console.log(err.code);
    });

  if ((await responseTokenSp.status) == 200) {
    console.log(responseTokenSp.data);
    try {
      var d = new Date();
      expires_at = d.getTime + responseTokenSp.data.expires_in * 1000;
      OAuthSp = responseTokenSp.data.access_token;
      // OAuRefreshTokenSp = responseTokenSp.data.refresh_token;

      fs.writeFileSync(
        "./spotify.json",
        JSON.stringify({
          refresh_token: responseTokenSp.data.refresh_token,
        })
      );
    } catch (error) {
      console.error(error);
      console.log("hist");
      // TokenSpotify();
      return;
    }

    Main();
  }
  // else TokenSpotify();
}
Main();
function Main() {
  let lastAdded;
  async function runnabale() {
    fetch(radiobollerwagen, { method: "GET" })
      .then((res) => res.json())
      .then((json) => {
        if (json.songs[0].title != lastAdded) {
          console.log(json.songs[0].title);
          lastAdded = json.songs[0].title;
          addToPlaylist(json.songs[0].title, json.songs[0].artist);
        }
      });
    try {
      const response = await api.get("/playlists/3WeU50f5AqaM0Z0aYQNoEz");
      console.log(response.data.tracks.total);
      let d = new Date();
      let t = d.getTime();
      t = t - 2 * 60 * 60 * 1000;
      let dateSong = new Date(response.data.tracks.items[0].added_at);
      let timeSong = dateSong.getTime();
      if (t >= timeSong) {
        const responsee = await api.delete(
          "/playlists/3WeU50f5AqaM0Z0aYQNoEz/tracks",
          {
            data: {
              tracks: [
                {
                  uri: response.data.tracks.items[0].track.uri,
                  positions: [0],
                },
              ],
            },
          }
        );
      }
    } catch (error) {
      console.log(error.code);
      return;
    }
  }
  runnabale();
  var timerID = setInterval(runnabale, 60 * 1000);
}

async function addToPlaylist(title, artist) {
  let findUri;
  try {
    let res = await api.get(
      `/search?q=${title.replace(" ", "+")}+${artist
        .replace(" UND ", "+")
        .replace(" ", "+")
        .replace(",", "")}&type=track&limit=1`
    );
    findUri = res.data.tracks.items[0].uri;
    try {
      let res = await api.post(`/playlists/3WeU50f5AqaM0Z0aYQNoEz/tracks`, {
        uris: [findUri],
      });
    } catch (error) {
      console.log(error.code);
      return;
    }
  } catch (error) {
    console.log(error.code);
    return;
  }
}

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

import { Metacom } from "./metacom.js";

const getApiUrl = () => {
  const protocol = location.protocol === "http:" ? "ws" : "wss";
  return `${protocol}://${location.host}/api`;
};

let state;

const initBackend = async () => {
  if (state) return state;

  const metacom = Metacom.create(getApiUrl());
  await metacom.load("example");

  state = { metacom, api: metacom.api };
  return state;
};

const getBackendState = () => state;

export { initBackend, getBackendState };


import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080/api/v1";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  console.log("Axios request:", {
    url: `${config.baseURL}${config.url}`,
    method: config.method,
    headers: config.headers,
  });

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Axios error details:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      code: error.code,
    });

    return Promise.reject(error);
  }
);


function unwrapStream(response) {
  let stream = response?.stream ?? response?.data ?? response;

  // Handle nested response: { data: { stream: {...} } }
  if (stream?.stream) {
    stream = stream.stream;
  }

  const id = stream?.id ?? stream?._id;
  const roomName = stream?.roomName ?? stream?.RoomName;

  if (!id) {
    console.error("Invalid stream response:", response);
    throw new Error("Stream response is missing id");
  }

  return {
    ...stream,
    id: String(id),
    roomName: roomName || `stream-${id}`,
  };
}

export async function createStream(title) {
  const { data } = await api.post("/streams", {
    title,
    sourceType: "camera",
  });

  return unwrapStream(data);
}

export async function startStream(id) {
  const { data } = await api.post(
    `/streams/${encodeURIComponent(id)}/start`,
    {}
  );

  return data;
}

export async function getStream(id) {
  const { data } = await api.get(
    `/streams/${encodeURIComponent(id)}`
  );

  return unwrapStream(data);
}

export async function getStreams() {
  const { data } = await api.get("/streams");

  const streams = Array.isArray(data)
    ? data
    : data.streams ?? data.data ?? [];

  return streams.map(unwrapStream);
}

export async function getLiveKitToken(id, role) {
  const { data } = await api.post(
    `/streams/${encodeURIComponent(id)}/token`,
    { role }
  );

  return data;
}

export async function endStream(id) {
  const { data } = await api.post(
    `/streams/${encodeURIComponent(id)}/end`,
    {}
  );

  return data;
}

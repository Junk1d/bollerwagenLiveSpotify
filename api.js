const api = axios.create({
    baseURL: "http://localhost:3002",
});

api.interceptors.request.use(
    (config) => {
        const token = user.token;
        if (token) {
            config.headers.Authorization = token;
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
                const refreshToken = localStorage.getItem("refresh_token");
                const response = await axios.post(
                    "http://localhost:3002/refreshToken",
                    {},
                    { headers: { refresh_token: refreshToken } }
                );
                const { token, refresh_token } = response.data;

                setUser((current) => {
                    return { ...current, token };
                });
                localStorage.setItem("refresh_token", refresh_token);

                originalRequest.headers.Authorization = token;
                return api(originalRequest);
            } catch (error) {}
        }

        return Promise.reject(error);
    }
);

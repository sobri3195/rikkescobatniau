export default {
  fetch() {
    return new Response("Static SPA build does not use server entry.", { status: 404 });
  },
};

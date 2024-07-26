import Fastify from "fastify";
import fastifySqlite from "fastify-sqlite";
import fastifyView from "@fastify/view";
import fastifyFormbody from "@fastify/formbody";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom logger serializer
const customSerializer = {
  req(request) {
    return {
      method: request.method,
      url: request.url,
      headers: request.headers,
      hostname: request.hostname,
      remoteAddress: request.ip,
      remotePort: request.socket.remotePort,
    };
  },
};

// Create Fastify instance
const createServer = async () => {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      serializers: customSerializer,
    },
  });

  // Register plugins
  await fastify.register(fastifySqlite, {
    promiseApi: true,
    dbFile: process.env.DB_FILE || ":memory:",
  });

  await fastify.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, "views"),
    viewExt: "ejs",
  });

  await fastify.register(fastifyFormbody);
  await fastify.register(fastifyHelmet);

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/public/",
  });

  // Add hooks
  fastify.addHook("onRequest", async (request, reply) => {
    request.log.info({ req: request }, "Incoming request");
  });

  // Custom error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request error");
    const statusCode = error.statusCode || 500;
    const errorMessage =
      statusCode === 500 ? "Internal Server Error" : error.message;
    reply.status(statusCode).send({ error: errorMessage });
  });

  return fastify;
};

// Define routes
const defineRoutes = (fastify) => {
  fastify.get("/", async (request, reply) => {
    try {
      const posts = await fastify.sqlite.all("SELECT * FROM posts");
      return reply.view("index", { posts });
    } catch (error) {
      throw new Error("Failed to fetch posts");
    }
  });

  fastify.get("/post/new", async (request, reply) => {
    return reply.view("new");
  });

  const postSchema = {
    body: {
      type: "object",
      required: ["title", "content"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 100 },
        content: { type: "string", minLength: 1 },
      },
    },
  };

  fastify.post("/post", { schema: postSchema }, async (request, reply) => {
    try {
      const { title, content } = request.body;
      await fastify.sqlite.run(
        "INSERT INTO posts (title, content) VALUES (?, ?)",
        [title, content]
      );
      return reply.redirect("/");
    } catch (error) {
      throw new Error("Failed to create post");
    }
  });

  fastify.get("/post/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const post = await fastify.sqlite.get(
        "SELECT * FROM posts WHERE id = ?",
        [id]
      );
      if (!post) {
        return reply.status(404).send({ error: "Post not found" });
      }
      return reply.view("post", { post });
    } catch (error) {
      throw new Error("Failed to fetch post");
    }
  });

  fastify.post("/post/:id/delete", async (request, reply) => {
    try {
      const { id } = request.params;
      await fastify.sqlite.run("DELETE FROM posts WHERE id = ?", [id]);
      return reply.redirect("/");
    } catch (error) {
      throw new Error("Failed to delete post");
    }
  });
};

// Main function
const start = async () => {
  try {
    const fastify = await createServer();
    defineRoutes(fastify);
    await fastify.listen({
      port: parseInt(process.env.PORT || "3000", 10),
      host: "0.0.0.0",
    });
    fastify.log.info(`Server listening at ${fastify.server.address().port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();

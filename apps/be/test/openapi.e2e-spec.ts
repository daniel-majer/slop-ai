import { readFile } from "node:fs/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiNoContentResponse } from "@nestjs/swagger";

import { ApiDataResponse } from "../src/common/api-data-response.decorator.js";
import { envelope } from "../src/common/transform-response.interceptor.js";
import {
  CreateSampleDto,
  SampleDto,
  SamplePageMetaDto,
  UpdateSampleDto,
} from "./fixtures/sample.dto.js";
import { useTestApp } from "./setup.js";

const ERROR_REF = "#/components/schemas/ErrorEnvelopeDto";

// Routes and models that exist only for these assertions.
const TEST_PATHS = new Set(["/api/boom", "/api/sample", "/api/sample/{id}"]);
const TEST_SCHEMAS = new Set([
  "CreateSampleDto",
  "UpdateSampleDto",
  "SampleDto",
  "SamplePageMetaDto",
]);

@Controller("boom")
class BoomController {
  @Get()
  @ApiDataResponse({ type: "object" }, { nullable: true })
  boom() {
    throw new Error("unexpected");
  }
}

/** In-memory resource covering list, read, create and delete documentation. */
@Controller("sample")
class SampleController {
  private readonly rows = new Map<number, SampleDto>();
  private nextId = 1;

  @Get()
  @ApiDataResponse(SampleDto, { isArray: true, meta: SamplePageMetaDto })
  list() {
    const data = [...this.rows.values()];
    return envelope(data, { nextCursor: null, hasNextPage: false });
  }

  @Get(":id")
  @ApiDataResponse(SampleDto)
  findOne(@Param("id", ParseIntPipe) id: number) {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundException(`Sample ${id} not found`);
    return row;
  }

  @Post()
  @ApiDataResponse(SampleDto)
  create(@Body() dto: CreateSampleDto) {
    const row: SampleDto = { id: this.nextId++, email: dto.email };
    this.rows.set(row.id, row);
    return row;
  }

  @Patch(":id")
  @ApiDataResponse(SampleDto)
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSampleDto) {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundException(`Sample ${id} not found`);
    const updated: SampleDto = { id: row.id, email: dto.email ?? row.email };
    this.rows.set(id, updated);
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: "Deleted." })
  remove(@Param("id", ParseIntPipe) id: number) {
    this.rows.delete(id);
  }
}

/** OpenAPI fields used by these assertions. */
interface Spec {
  openapi: string;
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        responses: Record<
          string,
          { content?: Record<string, { schema?: unknown }> }
        >;
      }
    >
  >;
  components: {
    schemas: Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    >;
  };
}

const operationsOf = (doc: Spec) =>
  Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      operation,
    })),
  );

const properties = (schema: unknown): string[] =>
  typeof schema === "object" && schema !== null && "properties" in schema
    ? Object.keys(schema.properties ?? {})
    : [];

const schemaOf = (doc: Spec, path: string, method: string, status: string) =>
  doc.paths[path]?.[method]?.responses[status]?.content?.["application/json"]
    ?.schema;

describe("OpenAPI document (e2e)", () => {
  const t = useTestApp({ controllers: [BoomController, SampleController] });

  const spec = async (): Promise<Spec> => {
    const res = await t.app.inject({ method: "GET", url: "/api/docs-json" });
    expect(res.statusCode).toBe(200);
    return res.json<Spec>();
  };

  it("is served for the client generator", async () => {
    const doc = await spec();

    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toContain("/api/health/ready");
  });

  it("matches the committed openapi.json", async () => {
    const doc = await spec();
    const committed: Spec = JSON.parse(
      await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
    );

    // Compare the full contract, excluding test-only routes and models.
    // Update with bun run api:sync.
    const paths = Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => !TEST_PATHS.has(path)),
    );
    const schemas = Object.fromEntries(
      Object.entries(doc.components.schemas).filter(
        ([name]) => !TEST_SCHEMAS.has(name),
      ),
    );

    expect({
      ...doc,
      paths,
      components: { ...doc.components, schemas },
    }).toEqual(committed);
  });

  it("derives validation constraints from DTO validators, including mapped types", async () => {
    const doc = await spec();
    const create = doc.components.schemas.CreateSampleDto;
    const update = doc.components.schemas.UpdateSampleDto;

    expect(create?.properties?.email).toMatchObject({
      type: "string",
      format: "email",
      maxLength: 255,
    });
    expect(create?.required).toContain("email");
    expect(update?.properties?.email).toEqual(create?.properties?.email);
    expect(update?.required ?? []).not.toContain("email");
  });

  describe("success responses", () => {
    it("documents a list as an array inside the data envelope", async () => {
      const doc = await spec();

      expect(schemaOf(doc, "/api/sample", "get", "200")).toEqual({
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/SampleDto" },
          },
          meta: { $ref: "#/components/schemas/SamplePageMetaDto" },
        },
      });
      expect(doc.components.schemas.SamplePageMetaDto).toMatchObject({
        required: ["nextCursor", "hasNextPage"],
        properties: {
          nextCursor: { type: "integer", nullable: true },
          hasNextPage: { type: "boolean" },
        },
      });
    });

    it("documents no meta on a route that never sends one", async () => {
      const doc = await spec();
      const schema = schemaOf(doc, "/api/sample/{id}", "get", "200");

      // Metadata must be explicitly enabled with { meta: true }.
      expect(properties(schema)).toEqual(["data"]);
    });

    it("documents create as 201, not 200", async () => {
      const doc = await spec();

      expect(doc.paths["/api/sample"]?.post?.responses["200"]).toBeUndefined();
      expect(schemaOf(doc, "/api/sample", "post", "201")).toBeDefined();
    });

    it("matches the envelope the interceptor really sends", async () => {
      await t.app.inject({
        method: "POST",
        url: "/api/sample",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({ method: "GET", url: "/api/sample" });

      expect(Object.keys(res.json())).toEqual(["data", "meta"]);
      expect(Array.isArray(res.json().data)).toBe(true);
    });
  });

  describe("error responses", () => {
    it("gives every operation a default error, decorated or not", async () => {
      const doc = await spec();
      const operations = operationsOf(doc);

      expect(operations.length).toBeGreaterThan(0);
      for (const { name, operation } of operations) {
        expect(
          operation.responses.default?.content?.["application/json"]?.schema,
          name,
        ).toEqual({ $ref: ERROR_REF });
      }
    });

    it("needs no per-status decorator on a route that can 404", async () => {
      const doc = await spec();
      const findOne = doc.paths["/api/sample/{id}"]?.get;

      expect(Object.keys(findOne?.responses ?? {})).toEqual(["200", "default"]);
    });

    it("matches what AllExceptionsFilter really sends", async () => {
      const doc = await spec();
      const envelopeSchema = doc.components.schemas.ErrorEnvelopeDto ?? {};
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({ method: "GET", url: "/api/sample/999" });
      const body = res.json();

      expect(res.statusCode).toBe(404);
      // All required fields must be present.
      expect(Object.keys(body)).toEqual(
        expect.arrayContaining(envelopeSchema.required ?? []),
      );
      expect(Object.keys(body.error)).toEqual(
        expect.arrayContaining(error.required ?? []),
      );
      // All returned fields must be documented.
      expect(Object.keys(error.properties ?? {})).toEqual(
        expect.arrayContaining(Object.keys(body.error)),
      );
    });

    it("documents details, which only a validation failure carries", async () => {
      const doc = await spec();
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({
        method: "POST",
        url: "/api/sample",
        payload: { email: "not-an-email" },
      });

      expect(Array.isArray(res.json().error.details)).toBe(true);
      expect(error.required).not.toContain("details");
      expect(error.properties?.details).toMatchObject({
        type: "array",
        items: { type: "string" },
      });
    });

    it("keeps an unexpected 500 inside the same envelope", async () => {
      const doc = await spec();
      const error = doc.components.schemas.ApiErrorDto ?? {};

      const res = await t.app.inject({ method: "GET", url: "/api/boom" });
      const body = res.json();

      expect(res.statusCode).toBe(500);
      expect(body.data).toBeNull();
      expect(body.error.details).toBeUndefined();
      expect(Object.keys(error.properties ?? {})).toEqual(
        expect.arrayContaining(Object.keys(body.error)),
      );
    });

    it("documents delete as an empty 204", async () => {
      const doc = await spec();
      const created = await t.app.inject({
        method: "POST",
        url: "/api/sample",
        payload: { email: "ada@example.com" },
      });

      const res = await t.app.inject({
        method: "DELETE",
        url: `/api/sample/${created.json().data.id}`,
      });

      expect(res.statusCode).toBe(204);
      expect(res.payload).toBe("");
      expect(
        doc.paths["/api/sample/{id}"]?.delete?.responses["204"]?.content,
      ).toBeUndefined();
    });
  });
});

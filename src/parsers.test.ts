/* eslint-disable @typescript-eslint/no-unused-vars */
import type { LoaderArgs } from '@remix-run/server-runtime';
import type { ZodEffects, ZodObject, ZodRawShape } from 'zod';
import type { TestOptions } from 'vitest';
import { FormData, NodeOnDiskFile, Request } from '@remix-run/node';
import { z } from 'zod';
import { zx } from './';

type Params = LoaderArgs['params'];

describe('parseParams', () => {
  type Result = { id: string; age: number };
  const params: Params = { id: 'id1', age: '10' };
  const paramsResult = { id: 'id1', age: 10 };
  const objectSchema = { id: z.string(), age: zx.IntAsString };

  testSchemas('parses params', objectSchema, async (schema) => {
    const result = await zx.parseParams(params, schema);
    expect(result).toStrictEqual(paramsResult);
    type verify = Expect<Equal<typeof result, Result>>;
  });

  testSchemas('throws for invalid params', objectSchema, async (schema) => {
    const badParams = { ...params, age: 'not a number' };
    await expect(() => zx.parseParams(badParams, schema)).rejects.toThrow();
  });
});

describe('parseParamsSafe', () => {
  type Result = { id: string; age: number };
  const params: Params = { id: 'id1', age: '10' };
  const paramsResult = { id: 'id1', age: 10 };
  const objectSchema = { id: z.string(), age: zx.IntAsString };

  testSchemas('parses params using an object', objectSchema, async (schema) => {
    const result = await zx.parseParamsSafe(params, schema);
    expect(result.success).toBe(true);
    if (result.success !== true) throw new Error('Parsing failed');
    expect(result.data).toStrictEqual(paramsResult);
    type verify = Expect<Equal<typeof result.data, Result>>;
  });

  testSchemas(
    'returns an error for invalid params using an object',
    objectSchema,
    async (schema) => {
      const badParams = { ...params, age: 'not a number' };
      const result = await zx.parseParamsSafe(badParams, schema);
      expect(result.success).toBe(false);
      if (result.success !== false)
        throw new Error('Parsing should have failed');
      expect(result.error.issues.length).toBe(1);
      expect(result.error.issues[0].path[0]).toBe('age');
    }
  );
});

describe('parseQuery', () => {
  type Result = { id: string; age: number; friends?: string[] };
  const search = new URLSearchParams({ id: 'id1', age: '10' });
  const queryResult = { id: 'id1', age: 10 };
  const objectSchema = {
    id: z.string(),
    age: zx.IntAsString,
    friends: z.array(z.string()).optional(),
  };

  testSchemas('parses URLSearchParams', objectSchema, async (schema) => {
    const result = await zx.parseQuery(search, schema);
    expect(result).toStrictEqual(queryResult);
    type verify = Expect<Equal<typeof result, Result>>;
  });

  testSchemas(
    'parses arrays from URLSearchParams',
    objectSchema,
    async (schema) => {
      const search = new URLSearchParams({ id: 'id1', age: '10' });
      search.append('friends', 'friend1');
      search.append('friends', 'friend2');
      const result = await zx.parseQuery(search, schema);
      expect(result).toStrictEqual({
        ...queryResult,
        friends: ['friend1', 'friend2'],
      });
      type verify = Expect<Equal<typeof result, Result>>;
    }
  );

  testSchemas(
    'parses query string from a Request',
    objectSchema,
    async (schema) => {
      const request = new Request(`http://example.com?${search.toString()}`);
      const result = await zx.parseQuery(request, schema);
      expect(result).toStrictEqual(queryResult);
      type verify = Expect<Equal<typeof result, Result>>;
    }
  );

  testSchemas(
    'throws for invalid query params',
    objectSchema,
    async (schema) => {
      const badRequest = new Request(
        `http://example.com?id=id1&age=notanumber`
      );
      await expect(() => zx.parseQuery(badRequest, schema)).rejects.toThrow();
    }
  );

  testSchemas(
    'supports custom URLSearchParam parsers',
    objectSchema,
    async (schema) => {
      const search = new URLSearchParams(
        `?id=id1&age=10&friends[]=friend1&friends[]=friend2`
      );
      const result = await zx.parseQuery(search, schema, {
        parser: customArrayParser,
      });
      expect(result).toStrictEqual({
        ...queryResult,
        friends: ['friend1', 'friend2'],
      });
      type verify = Expect<Equal<typeof result, Result>>;
    }
  );
});

describe('parseQuerySafe', () => {
  type Result = { id: string; age: number; friends?: string[] };
  const queryResult = { id: 'id1', age: 10 };
  const objectSchema = {
    id: z.string(),
    age: zx.IntAsString,
    friends: z.array(z.string()).optional(),
  };

  testSchemas('parses URLSearchParams', objectSchema, async (schema) => {
    const search = new URLSearchParams({ id: 'id1', age: '10' });
    const result = await zx.parseQuerySafe(search, schema);
    expect(result.success).toBe(true);
    if (result.success !== true) throw new Error('Parsing failed');
    expect(result.data).toStrictEqual(queryResult);
    type verify = Expect<Equal<typeof result.data, Result>>;
  });

  testSchemas(
    'parses arrays from URLSearchParams using an object',
    objectSchema,
    async (schema) => {
      const search = new URLSearchParams({ id: 'id1', age: '10' });
      search.append('friends', 'friend1');
      search.append('friends', 'friend2');
      const result = await zx.parseQuerySafe(search, schema);
      expect(result.success).toBe(true);
      if (result.success !== true) throw new Error('Parsing failed');
      expect(result.data).toStrictEqual({
        ...queryResult,
        friends: ['friend1', 'friend2'],
      });
      type verify = Expect<Equal<typeof result.data, Result>>;
    }
  );

  testSchemas(
    'parses query string from a Request',
    objectSchema,
    async (schema) => {
      const search = new URLSearchParams({ id: 'id1', age: '10' });
      const request = new Request(`http://example.com?${search.toString()}`);
      const result = await zx.parseQuerySafe(request, schema);
      expect(result.success).toBe(true);
      if (result.success !== true) throw new Error('Parsing failed');
      expect(result.data).toStrictEqual(queryResult);
      type verify = Expect<Equal<typeof result.data, Result>>;
    }
  );

  testSchemas(
    'returns an error for invalid query params',
    objectSchema,
    async (schema) => {
      const badRequest = new Request(
        `http://example.com?id=id1&age=notanumber`
      );
      const result = await zx.parseQuerySafe(badRequest, schema);
      expect(result.success).toBe(false);
      if (result.success !== false)
        throw new Error('Parsing should have failed');
      expect(result.error.issues.length).toBe(1);
      expect(result.error.issues[0].path[0]).toBe('age');
    }
  );
});

const createFormRequest = (age: string = '10') => {
  const form = new FormData();
  form.append('id', 'id1');
  form.append('age', age);
  form.append('consent', 'on');
  return new Request('http://example.com', { method: 'POST', body: form });
};

describe('parseForm', () => {
  type Result = {
    id: string;
    age: number;
    consent: boolean;
    friends?: string[];
    image?: NodeOnDiskFile;
  };
  const formResult = { id: 'id1', age: 10, consent: true };
  const objectSchema = {
    id: z.string(),
    age: zx.IntAsString,
    consent: zx.CheckboxAsString,
    friends: z.array(z.string()).optional(),
    image: z.instanceof(NodeOnDiskFile).optional(),
  };

  testSchemas('parses FormData from Request', objectSchema, async (schema) => {
    const request = createFormRequest();
    const result = await zx.parseForm(request, schema);
    expect(result).toStrictEqual(formResult);
    type verify = Expect<Equal<typeof result, Result>>;
  });

  testSchemas('parses FormData from FormData', objectSchema, async (schema) => {
    const formData = await createFormRequest().formData();
    const result = await zx.parseForm(formData, schema);
    expect(result).toStrictEqual(formResult);
    type verify = Expect<Equal<typeof result, Result>>;
  });

  testSchemas(
    'parses arrays from FormData of a Request',
    objectSchema,
    async (schema) => {
      const form = new FormData();
      form.append('id', 'id1');
      form.append('age', '10');
      form.append('friends', 'friend1');
      form.append('friends', 'friend2');
      form.append('consent', 'on');
      const request = new Request('http://example.com', {
        method: 'POST',
        body: form,
      });
      const result = await zx.parseForm(request, schema);
      expect(result).toStrictEqual({
        ...formResult,
        friends: ['friend1', 'friend2'],
      });
      type verify = Expect<Equal<typeof result, Result>>;
    }
  );

  testSchemas(
    'parses objects keys of FormData from FormData using a schema',
    objectSchema,
    async (schema) => {
      const request = createFormRequest();
      const form = await request.formData();
      const image = new NodeOnDiskFile('public/image.jpeg', 'image/jpeg');
      form.append('image', image);
      const parser = getCustomFileParser('image');
      const result = await zx.parseForm(form, schema, { parser });
      expect(result).toStrictEqual({
        ...formResult,
        image,
      });
      type verify = Expect<Equal<typeof result, Result>>;
    }
  );

  testSchemas('throws for invalid FormData', objectSchema, async (schema) => {
    const badRequest = createFormRequest('notanumber');
    await expect(() => zx.parseQuery(badRequest, schema)).rejects.toThrow();
  });
});

describe('parseFormSafe', () => {
  type Result = {
    id: string;
    age: number;
    consent: boolean;
    friends?: string[];
    image?: NodeOnDiskFile;
  };
  const formResult = { id: 'id1', age: 10, consent: true };
  const objectSchema = {
    id: z.string(),
    age: zx.IntAsString,
    consent: zx.CheckboxAsString,
    friends: z.array(z.string()).optional(),
    image: z.instanceof(NodeOnDiskFile).optional(),
  };

  testSchemas('parses FormData from Request', objectSchema, async (schema) => {
    const request = createFormRequest();
    const result = await zx.parseFormSafe(request, schema);
    expect(result.success).toBe(true);
    if (result.success !== true) throw new Error('Parsing failed');
    expect(result.data).toStrictEqual(formResult);
    type verify = Expect<Equal<typeof result.data, Result>>;
  });

  testSchemas('parses FormData from FormData', objectSchema, async (schema) => {
    const formData = await createFormRequest().formData();
    const result = await zx.parseFormSafe(formData, schema);
    expect(result.success).toBe(true);
    if (result.success !== true) throw new Error('Parsing failed');
    expect(result.data).toStrictEqual(formResult);
    type verify = Expect<Equal<typeof result.data, Result>>;
  });

  testSchemas(
    'returns an error for invalid FormData',
    objectSchema,
    async (schema) => {
      const badRequest = createFormRequest('notanumber');
      const result = await zx.parseFormSafe(badRequest, schema);
      expect(result.success).toBe(false);
      if (result.success !== false)
        throw new Error('Parsing should have failed');
      expect(result.error.issues.length).toBe(1);
      expect(result.error.issues[0].path[0]).toBe('age');
    }
  );

  testSchemas(
    'parses objects keys of FormData from FormData',
    objectSchema,
    async (schema) => {
      const request = createFormRequest();
      const form = await request.formData();
      const image = new NodeOnDiskFile('public/image.jpeg', 'image/jpeg');
      form.append('image', image);
      const parser = getCustomFileParser('image');
      const result = await zx.parseFormSafe(form, schema, { parser });
      expect(result.success).toBe(true);
      if (result.success !== true) throw new Error('Parsing failed');
      expect(result.data).toStrictEqual({
        ...formResult,
        image,
      });
      type verify = Expect<Equal<typeof result.data, Result>>;
    }
  );
});

// Custom URLSearchParams parser that cleans arr[] keys
function customArrayParser(searchParams: URLSearchParams) {
  const values: { [key: string]: string | string[] } = {};
  for (const [key, value] of searchParams) {
    // Remove trailing [] from array keys
    const cleanKey = key.replace(/\[\]$/, '');
    const currentVal = values[cleanKey];
    if (currentVal && Array.isArray(currentVal)) {
      currentVal.push(value);
    } else if (currentVal) {
      values[cleanKey] = [currentVal, value];
    } else {
      values[cleanKey] = value;
    }
  }
  return values;
}

// Custom URLSearchParams parser that casts a set of key to NodeOnDiskFile
type CustomParsedSearchParams = {
  [key: string]: string | string[] | NodeOnDiskFile;
};
function getCustomFileParser(...fileKeys: string[]) {
  return function (searchParams: URLSearchParams) {
    const values: CustomParsedSearchParams = {};
    for (const [key, value] of searchParams) {
      const currentVal = values[key];
      if (fileKeys.includes(key)) {
        const obj = JSON.parse(value);
        values[key] = new NodeOnDiskFile(obj.filepath, obj.type, obj.slicer);
      } else if (currentVal && Array.isArray(currentVal)) {
        currentVal.push(value);
      } else if (currentVal && typeof currentVal === 'string') {
        values[key] = [currentVal, value];
      } else {
        values[key] = value;
      }
    }
    return values;
  };
}

/**
 * Generate schema variants for testing
 * @param object - A Zod object shape to be tested.
 * @returns `{ object, zod, async }` - An object containing schema variants,
 * i.e. an object shape, a Zod schema, and a Zod async schema.
 */
function getSchemas<T extends ZodRawShape>(
  object: T
): {
  object: T;
  zod: ZodObject<T>;
  async: ZodEffects<ZodObject<T>>;
} {
  const zod = z.object(object);
  const async = zod.transform((data) => Promise.resolve(data));
  return {
    object,
    zod,
    async,
  };
}

/**
 * Testing helper that generates a `describe` call with a `test` for each schema variant.
 * @param description - The description of the test.
 * @param schema - A Zod object shape to perform the tests.
 * @param fn - A test function that takes a Zod schema as an argument.
 * @param options - Describe options.
 * @returns {SuiteCollector} - The SuiteCollector instance resulting from the `describe` call.
 */
function testSchemas<T extends ZodRawShape>(
  description: string,
  schema: T,
  fn: (schema: T | ZodObject<T> | ZodEffects<ZodObject<T>>) => void,
  options?: number | TestOptions | undefined
) {
  return describe(
    description,
    () => {
      Object.entries(getSchemas(schema)).forEach(([type, schema]) => {
        test(`using ${type} schema`, async () => {
          await fn(schema);
        });
      });
    },
    options
  );
}
// Ensure parsed results are typed correctly. Thanks Matt!
// https://github.com/total-typescript/zod-tutorial/blob/main/src/helpers/type-utils.ts
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;

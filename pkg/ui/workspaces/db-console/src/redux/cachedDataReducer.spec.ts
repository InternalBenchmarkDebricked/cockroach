// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

import { assert } from "chai";
import _ from "lodash";
import { Action } from "redux";
import moment from "moment";
import {
  CachedDataReducer,
  CachedDataReducerState,
  KeyedCachedDataReducer,
  KeyedCachedDataReducerState,
  WithPaginationRequest,
  WithPaginationResponse,
  PaginatedCachedDataReducer,
  PaginatedCachedDataReducerState,
} from "./cachedDataReducer";

describe("basic cachedDataReducer", function() {
  class Request {
    constructor(public request: string) {}
  }

  class Response {
    constructor(public response: string) {}
  }

  const apiEndpointMock: (req: Request) => Promise<Response> = (
    req = new Request(null),
  ) => new Promise((resolve, _reject) => resolve(new Response(req.request)));

  let expected: CachedDataReducerState<Response>;

  describe("reducerObj", function() {
    const actionNamespace = "test";
    const testReducerObj = new CachedDataReducer<Request, Response>(
      apiEndpointMock,
      actionNamespace,
    );

    describe("actions", function() {
      it("requestData() creates the correct action type.", function() {
        assert.equal(testReducerObj.requestData().type, testReducerObj.REQUEST);
      });

      it("receiveData() creates the correct action type.", function() {
        assert.equal(
          testReducerObj.receiveData(null).type,
          testReducerObj.RECEIVE,
        );
      });

      it("errorData() creates the correct action type.", function() {
        assert.equal(testReducerObj.errorData(null).type, testReducerObj.ERROR);
      });

      it("invalidateData() creates the correct action type.", function() {
        assert.equal(
          testReducerObj.invalidateData().type,
          testReducerObj.INVALIDATE,
        );
      });
    });

    const reducer = testReducerObj.reducer;
    const testMoment = moment();
    testReducerObj.setTimeSource(() => testMoment);

    describe("reducer", function() {
      let state: CachedDataReducerState<Response>;
      beforeEach(() => {
        state = reducer(undefined, { type: "unknown" });
      });

      it("should have the correct default value.", function() {
        expected = new CachedDataReducerState<Response>();
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch requestData", function() {
        state = reducer(state, testReducerObj.requestData());
        expected = new CachedDataReducerState<Response>();
        expected.inFlight = true;
        expected.requestedAt = testMoment;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch receiveData", function() {
        const expectedResponse = new Response(null);
        state = reducer(
          state,
          testReducerObj.receiveData(expectedResponse, null),
        );
        expected = new CachedDataReducerState<Response>();
        expected.valid = true;
        expected.data = expectedResponse;
        expected.setAt = testMoment;
        expected.lastError = null;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch errorData", function() {
        const e = new Error();

        state = reducer(state, testReducerObj.errorData(e, null));
        expected = new CachedDataReducerState<Response>();
        expected.lastError = e;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch invalidateData", function() {
        state = reducer(state, testReducerObj.invalidateData());
        expected = new CachedDataReducerState<Response>();
        assert.deepEqual(state, expected);
      });
    });

    describe("refresh", function() {
      let state: {
        cachedData: {
          test: CachedDataReducerState<Response>;
        };
      };

      const mockDispatch = <A extends Action>(action: A): A => {
        state.cachedData.test = testReducerObj.reducer(
          state.cachedData.test,
          action,
        );
        return undefined;
      };

      it("correctly dispatches refresh", function() {
        state = {
          cachedData: {
            test: new CachedDataReducerState<Response>(),
          },
        };

        const testString = "refresh test string";

        return testReducerObj
          .refresh(new Request(testString))(
            mockDispatch,
            () => state,
            undefined,
          )
          .then(() => {
            expected = new CachedDataReducerState<Response>();
            expected.valid = true;
            expected.data = new Response(testString);
            expected.requestedAt = testMoment;
            expected.setAt = testMoment;
            expected.lastError = null;
            assert.deepEqual(state.cachedData.test, expected);
          });
      });
    });
  });

  describe("multiple reducer objects", function() {
    it("should throw an error if the same actionNamespace is used twice", function() {
      new CachedDataReducer<Request, Response>(
        apiEndpointMock,
        "duplicatenamespace",
      );
      try {
        new CachedDataReducer<Request, Response>(
          apiEndpointMock,
          "duplicatenamespace",
        );
      } catch (e) {
        assert(_.isError(e));
        return;
      }
      assert.fail(
        "Expected to fail after registering a duplicate actionNamespace.",
      );
    });
  });
});

describe("keyed cachedDataReducer", function() {
  class Request {
    constructor(public request: string) {}
  }

  class Response {
    constructor(public response: string) {}
  }

  const apiEndpointMock: (req: Request) => Promise<Response> = (
    req = new Request(null),
  ) => new Promise((resolve, _reject) => resolve(new Response(req.request)));

  const requestToID = (req: Request) => req.request;

  let expected: KeyedCachedDataReducerState<Response>;

  describe("reducerObj", function() {
    const actionNamespace = "keyedTest";
    const testReducerObj = new KeyedCachedDataReducer<Request, Response>(
      apiEndpointMock,
      actionNamespace,
      requestToID,
    );

    describe("actions", function() {
      it("requestData() creates the correct action type.", function() {
        const request = new Request("testRequestRequest");
        const requestAction = testReducerObj.cachedDataReducer.requestData(
          request,
        );
        assert.equal(
          requestAction.type,
          testReducerObj.cachedDataReducer.REQUEST,
        );
        assert.deepEqual(requestAction.payload, { request });
      });

      it("receiveData() creates the correct action type.", function() {
        const response = new Response("testResponse");
        const request = new Request("testResponseRequest");
        const receiveAction = testReducerObj.cachedDataReducer.receiveData(
          response,
          request,
        );
        assert.equal(
          receiveAction.type,
          testReducerObj.cachedDataReducer.RECEIVE,
        );
        assert.deepEqual(receiveAction.payload, { request, data: response });
      });

      it("errorData() creates the correct action type.", function() {
        const error = new Error();
        const request = new Request("testErrorRequest");
        const errorAction = testReducerObj.cachedDataReducer.errorData(
          error,
          request,
        );
        assert.equal(errorAction.type, testReducerObj.cachedDataReducer.ERROR);
        assert.deepEqual(errorAction.payload, { request, data: error });
      });

      it("invalidateData() creates the correct action type.", function() {
        const request = new Request("testInvalidateRequest");
        const invalidateAction = testReducerObj.cachedDataReducer.invalidateData(
          request,
        );
        assert.equal(
          invalidateAction.type,
          testReducerObj.cachedDataReducer.INVALIDATE,
        );
        assert.deepEqual(invalidateAction.payload, { request });
      });
    });

    const reducer = testReducerObj.reducer;
    const testMoment = moment();
    testReducerObj.setTimeSource(() => testMoment);

    describe("keyed reducer", function() {
      let state: KeyedCachedDataReducerState<Response>;
      let id: string;
      let request: Request;
      beforeEach(() => {
        state = reducer(undefined, { type: "unknown" });
        id = Math.random().toString();
        request = new Request(id);
      });

      it("should have the correct default value.", function() {
        expected = new KeyedCachedDataReducerState<Response>();
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch requestData", function() {
        state = reducer(
          state,
          testReducerObj.cachedDataReducer.requestData(request),
        );
        expected = new KeyedCachedDataReducerState<Response>();
        expected[id] = new CachedDataReducerState<Response>();
        expected[id].requestedAt = testMoment;
        expected[id].inFlight = true;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch receiveData", function() {
        const expectedResponse = new Response(null);

        state = reducer(
          state,
          testReducerObj.cachedDataReducer.receiveData(
            expectedResponse,
            request,
          ),
        );
        expected = new KeyedCachedDataReducerState<Response>();
        expected[id] = new CachedDataReducerState<Response>();
        expected[id].valid = true;
        expected[id].data = expectedResponse;
        expected[id].lastError = null;
        expected[id].setAt = testMoment;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch errorData", function() {
        const e = new Error();

        state = reducer(
          state,
          testReducerObj.cachedDataReducer.errorData(e, request),
        );
        expected = new KeyedCachedDataReducerState<Response>();
        expected[id] = new CachedDataReducerState<Response>();
        expected[id].lastError = e;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch invalidateData", function() {
        state = reducer(
          state,
          testReducerObj.cachedDataReducer.invalidateData(request),
        );
        expected = new KeyedCachedDataReducerState<Response>();
        expected[id] = new CachedDataReducerState<Response>();
        assert.deepEqual(state, expected);
      });
    });
  });
});

describe.only("PaginatedCachedDataReducer", function() {
  class Request implements WithPaginationRequest {
    constructor(
      public request: string,
      public page_size: number,
      public page_token: string,
    ) {}
  }

  class Response implements WithPaginationResponse {
    constructor(public response: string, public next_page_token: string) {}
  }

  const apiEndpointMockFactory: (
    totalPages: number,
    pageSize: number,
  ) => (req: Request) => Promise<Response> = (
    totalPages: number = 5,
    pageSize: number = 10,
  ) => {
    let requestCounter = 0;
    return (req = new Request(null, pageSize, requestCounter.toString())) => {
      if (requestCounter < totalPages) {
        requestCounter++;
      }
      return new Promise((resolve, _reject) => {
        resolve(
          new Response(`${req.request}-${requestCounter}`, `${requestCounter}`),
        );
      });
    };
  };

  const requestToID = (req: Request) => req.page_token;

  let expected: PaginatedCachedDataReducerState<Response>;

  describe("reducerObj", function() {
    const actionNamespace = "paginatedKey";
    const totalPagesNum = 5;
    const testReducerObj = new PaginatedCachedDataReducer<Request, Response>(
      apiEndpointMockFactory(totalPagesNum, 10),
      actionNamespace,
      requestToID,
    );

    describe("actions", function() {
      it("requestData() creates the correct action type.", function() {
        const request = new Request("testRequestRequest", undefined, undefined);
        const requestAction = testReducerObj.cachedDataReducer.requestData(
          request,
        );
        assert.equal(
          requestAction.type,
          testReducerObj.cachedDataReducer.REQUEST,
        );
        assert.deepEqual(requestAction.payload, { request });
      });

      it("receiveData() creates the correct action type.", function() {
        const response = new Response("testResponse", "1");
        const request = new Request("testRequestRequest", 5, undefined);
        const receiveAction = testReducerObj.cachedDataReducer.receiveData(
          response,
          request,
        );
        assert.equal(
          receiveAction.type,
          testReducerObj.cachedDataReducer.RECEIVE,
        );
        assert.deepEqual(receiveAction.payload, { request, data: response });
      });

      it("errorData() creates the correct action type.", function() {
        const error = new Error();
        const request = new Request("testRequestRequest", 5, undefined);
        const errorAction = testReducerObj.cachedDataReducer.errorData(
          error,
          request,
        );
        assert.equal(errorAction.type, testReducerObj.cachedDataReducer.ERROR);
        assert.deepEqual(errorAction.payload, { request, data: error });
      });

      it("invalidateData() creates the correct action type.", function() {
        const request = new Request("testRequestRequest", 5, undefined);
        const invalidateAction = testReducerObj.cachedDataReducer.invalidateData(
          request,
        );
        assert.equal(
          invalidateAction.type,
          testReducerObj.cachedDataReducer.INVALIDATE,
        );
        assert.deepEqual(invalidateAction.payload, { request });
      });
    });

    const reducer = testReducerObj.reducer;
    const testMoment = moment();
    testReducerObj.setTimeSource(() => testMoment);

    describe("paginated reducer", function() {
      let state: PaginatedCachedDataReducerState<Response>;
      let id: string;
      let request: Request;
      beforeEach(() => {
        state = reducer(undefined, { type: "unknown" });
        id = Math.random().toString();
        request = new Request(id, 10, id);
      });

      it("should have the correct default value.", function() {
        expected = new PaginatedCachedDataReducerState<Response>();
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch requestData", function() {
        state = reducer(
          state,
          testReducerObj.cachedDataReducer.requestData(request),
        );
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.requestedAt = testMoment;
        expected.inFlight = true;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch receiveData", function() {
        const expectedResponse = new Response(null, "1");

        state = reducer(
          state,
          testReducerObj.cachedDataReducer.receiveData(
            expectedResponse,
            request,
          ),
        );
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.valid = false;
        expected.inFlight = true;
        expected.data[id] = expectedResponse;
        expected.lastError = null;
        expected.setAt = testMoment;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch errorData", function() {
        const e = new Error();
        state = reducer(
          state,
          testReducerObj.cachedDataReducer.errorData(e, request),
        );
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.lastError = e;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch invalidateData", function() {
        state = reducer(
          state,
          testReducerObj.cachedDataReducer.invalidateData(request),
        );
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.valid = false;
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch cleanData", function() {
        state = reducer(state, testReducerObj.clearData(request));
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.data = {};
        expected.valid = false;
        expected.setAt = undefined;
        expected.requestedAt = undefined;
        console.log("state", JSON.stringify(state, undefined, 2));
        console.log("expected", JSON.stringify(expected, undefined, 2));
        assert.deepEqual(state, expected);
      });

      it("should correctly dispatch receiveCompleted", function() {
        state = reducer(state, testReducerObj.receiveCompleted(request));
        expected = new PaginatedCachedDataReducerState<Response>();
        expected.valid = true;
        expected.inFlight = false;
        expected.setAt = testMoment;
        expected.lastError = null;
        assert.deepEqual(state, expected);
      });
    });

    describe("refresh", function() {
      let state: PaginatedCachedDataReducerState<Response>;
      let id: string;
      let request: Request;

      beforeEach(() => {
        state = reducer(undefined, undefined);
        id = Math.random().toString();
        request = new Request(id, 10, "");
      });

      const mockDispatch = <A extends Action>(action: A): A => {
        state = testReducerObj.reducer(state, action);
        return undefined;
      };

      it("correctly dispatches refresh", function() {
        const pageState = new PaginatedCachedDataReducerState<Response>();
        pageState.valid = true;
        pageState.lastError = null;
        pageState.setAt = testMoment;
        pageState.requestedAt = testMoment;

        const expectedPageTokens = Array(totalPagesNum)
          .fill("")
          .map((_, i) => `${i + 1}`)
          .concat(["", id]);

        return testReducerObj
          .refresh(request, s => s[id])(mockDispatch, () => state, undefined)
          .then(() => {
            Object.keys(state.data).forEach(k => {
              assert.isTrue(expectedPageTokens.some(t => t === k));
            });
          });
      });
    });
  });
});

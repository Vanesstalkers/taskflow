/* This import should not be removed. We need to reference impress explicitly
 * so that tsc correctly resolved global variables.
 * For some odd reason using typeRoots results in an array of errors.
 * The problem should have been fixed by having an index file but no luck.
 * PR with the correct fix would be greatly appreciated. */
import * as _impress from 'impress';

import * as _metasql from 'metasql';
import { Database } from 'metasql';
import { Db, MongoClient } from 'mongodb';

declare global {
  namespace metarhia {
    const metasql: typeof _metasql;
  }

  namespace api {
    interface StatusResult {
      status: 'ok' | 'error';
    }

    interface TaskDto {
      id: string;
      title: string;
      status: 'todo' | 'inProgress' | 'done' | string;
      createdAt: Date | null;
      updatedAt: Date | null;
    }

    function getUserTaskList(): Promise<{ tasks: TaskDto[]; users: UserDto[]; lst: Record<string, unknown[]> }>;

    function taskMove(params: {
      id: string;
      direction: 'forward' | 'backward';
    }): Promise<StatusResult & { changed: boolean }>;

    function addObject(params: {
      collection: string;
      document: Record<string, unknown>;
      _id?: string;
      linkField?: string;
      linkPayload?: Record<string, unknown>;
    }): Promise<StatusResult & { createdId?: string }>;

    function updateField(params: {
      collection: string;
      _id: string;
      data: Record<string, unknown>;
      taskType?: string;
      schemaPath?: string[];
      linkField?: string;
    }): Promise<StatusResult>;

    /** Одна связь в мапе (например userLinks): add / remove по ключу targetId */
    function updateLink(params: {
      collection: string;
      id: string;
      linkField: string;
      targetId: string;
      action: 'add' | 'remove';
      linkPayload?: Record<string, unknown>;
      linkDocument?: Record<string, unknown>;
    }): Promise<StatusResult>;

    /** Поиск по коллекции; поля задаются в `domain.collections[collection].search.fields` */
    function search(params: {
      collection: string;
      search?: string;
      limit?: number;
    }): Promise<{ items: Record<string, unknown>[]; currentUserId: string; collection: string }>;

    /** Начальные данные UI: вкладки, коллекции поиска, избранное, бейдж замечаний */
    function loadView(): Promise<{
      currentUserId: string;
      activeTabId: string;
      tabs: Array<Record<string, unknown>>;
      collections: Array<{
        collection: string;
        title: string;
        fields: string[];
      }>;
      favourites: Array<Record<string, unknown>>;
      remarksBadgeCount: number;
    }>;

    /** Глобальный поиск: задачи пользователя и коллекции с `search` */
    function searchGlobal(params: {
      search?: string;
      limit?: number;
    }): Promise<{
      groups: Array<{
        kind: 'task' | 'collection';
        collection: string;
        title: string;
        items: Array<{ code: string; title: string }>;
      }>;
      currentUserId: string;
    }>;
  }

  namespace lib {}

  namespace domain {}

  namespace db {
    const pg: Database;
    namespace mongodb {
      const client: MongoClient;
      const database: Db;
      function connect(): Promise<Db>;
      function findOne(collection: string, query: object, options?: object): Promise<object | null>;
      function insertOne(collection: string, document: object): Promise<{ acknowledged: boolean; insertedId: unknown }>;
    }
  }
}

export interface ErrorOptions {
  code?: number | string;
  cause?: Error;
}

export class Error extends global.Error {
  constructor(message: string, options?: number | string | ErrorOptions);
  message: string;
  stack: string;
  code?: number | string;
  cause?: Error;
}

type Errors = Record<string, string>;

export class DomainError extends Error {
  constructor(code?: string, options?: number | string | ErrorOptions);
  message: string;
  stack: string;
  code?: number | string;
  cause?: Error;
  toError(errors: Errors): Error;
}

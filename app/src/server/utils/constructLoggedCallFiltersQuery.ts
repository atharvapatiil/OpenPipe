import { type z } from "zod";
import { type Expression, type SqlBool, sql, type RawBuilder } from "kysely";
import { kysely } from "~/server/db";
import {
  LoggedCallsFiltersDefaultFields,
  type comparators,
  type filtersSchema,
} from "~/types/shared.types";

// create comparator type based off of comparators
export const comparatorToSqlExpression = (
  comparator: (typeof comparators)[number],
  value: string,
) => {
  return (reference: RawBuilder<unknown>): Expression<SqlBool> => {
    switch (comparator) {
      case "=":
        return sql`${reference} = ${value}`;
      case "!=":
        // Handle NULL values
        return sql`${reference} IS DISTINCT FROM ${value}`;
      case "CONTAINS":
        return sql`${reference} LIKE ${"%" + value + "%"}`;
      case "NOT_CONTAINS":
        return sql`(${reference} NOT LIKE ${"%" + value + "%"} OR ${reference} IS NULL)`;
      default:
        throw new Error("Unknown comparator");
    }
  };
};

export const constructLoggedCallFiltersQuery = (
  filters: z.infer<typeof filtersSchema>,
  projectId: string,
  selectionParams?: {
    defaultToSelected: boolean;
    selectedLogIds: string[];
    deselectedLogIds: string[];
  },
) => {
  const baseQuery = kysely
    .selectFrom("LoggedCall as lc")
    .leftJoin("LoggedCallModelResponse as lcmr", "lc.id", "lcmr.originalLoggedCallId")
    .where((eb) => {
      const wheres: Expression<SqlBool>[] = [eb("lc.projectId", "=", projectId)];

      for (const filter of filters) {
        if (!filter.value) continue;
        const filterExpression = comparatorToSqlExpression(filter.comparator, filter.value);

        if (filter.field === LoggedCallsFiltersDefaultFields.Request) {
          wheres.push(filterExpression(sql.raw(`lcmr."reqPayload"::text`)));
        }
        if (filter.field === LoggedCallsFiltersDefaultFields.Response) {
          wheres.push(filterExpression(sql.raw(`lcmr."respPayload"::text`)));
        }
        if (filter.field === LoggedCallsFiltersDefaultFields.Model) {
          wheres.push(filterExpression(sql.raw(`lc."model"`)));
        }
        if (filter.field === LoggedCallsFiltersDefaultFields.StatusCode) {
          wheres.push(filterExpression(sql.raw(`lcmr."statusCode"::text`)));
        }
      }

      return eb.and(wheres);
    });

  const tagFilters = filters.filter(
    (filter) =>
      !Object.values(LoggedCallsFiltersDefaultFields).includes(
        filter.field as LoggedCallsFiltersDefaultFields,
      ),
  );

  let updatedBaseQuery = baseQuery;

  for (let i = 0; i < tagFilters.length; i++) {
    const filter = tagFilters[i];
    if (!filter?.value) continue;
    const tableAlias = `lct${i}`;
    const filterExpression = comparatorToSqlExpression(filter.comparator, filter.value);

    updatedBaseQuery = updatedBaseQuery
      .leftJoin(`LoggedCallTag as ${tableAlias}`, (join) =>
        join
          .onRef("lc.id", "=", `${tableAlias}.loggedCallId`)
          .on(`${tableAlias}.name`, "=", filter.field),
      )
      .where(filterExpression(sql.raw(`${tableAlias}.value`))) as unknown as typeof baseQuery;
  }

  if (selectionParams) {
    if (selectionParams.defaultToSelected && selectionParams.deselectedLogIds.length) {
      updatedBaseQuery = updatedBaseQuery.where(({ eb, not }) =>
        not(eb("lc.id", "in", selectionParams.deselectedLogIds)),
      );
    } else if (!selectionParams.defaultToSelected && selectionParams.selectedLogIds.length) {
      updatedBaseQuery = updatedBaseQuery.where((eb) =>
        eb("lc.id", "in", selectionParams.selectedLogIds),
      );
    }
    updatedBaseQuery = updatedBaseQuery.where((eb) => eb("lcmr.statusCode", "=", 200));
  }

  return updatedBaseQuery;
};
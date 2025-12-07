// middlewares/validate.js
import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

/**
 * validate(schema, source)
 *  - schema: a Zod schema or an object { body, params, query }
 *  - source: optional override; when schema is Zod, source can be "body"|"params"|"query"
 */
export const validate =
    (schema, source = "body") =>
        (req, res, next) => {
            try {
                // allow passing a single zod schema with explicit source
                if (schema?.parse) {
                    const data = req[source];
                    schema.parse(data);
                    return next();
                }

                // or an object { body, params, query } of schemas
                const toValidate = schema;
                if (toValidate.body) toValidate.body.parse(req.body);
                if (toValidate.params) toValidate.params.parse(req.params);
                if (toValidate.query) toValidate.query.parse(req.query);

                return next();
            } catch (err) {
                if (err instanceof ZodError) {
                    // build nice error message
                    const details = err.errors.map(e => ({
                        path: e.path.join("."),
                        message: e.message
                    }));
                    return next(new ApiError(400, "Validation error", { details }));
                }
                return next(err);
            }
        };
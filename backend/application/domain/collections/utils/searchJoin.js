/**
 * Aggregate-поиск с $lookup по первой связи из linkField (мапа id → {}).
 * Фильтр — после join: `fields` на корне, `matchFields` на связанном документе, опционально `enrichAs`.
 *
 * @param {{
 *   search: string,
 *   limit: number,
 *   fields: string[],
 *   matchFields?: string[],
 *   linkField: string,
 *   from: string,
 *   enrichAs?: string,
 *   enrichParts?: string[],
 * }} params
 * @returns {{ mode: 'aggregate', pipeline: object[] }}
 */
({
  join({ search, limit, fields, matchFields = [], linkField, from, enrichAs = '_joined', enrichParts = [] }) {
    const cap = Math.max(1, Number(limit) || 20);
    const rootFields = Array.isArray(fields) ? fields : [];
    const joinedFields = Array.isArray(matchFields) ? matchFields : [];
    const linkPath = `$${linkField}`;
    const parts = Array.isArray(enrichParts) ? enrichParts : [];
    const regex = { $regex: search, $options: 'i' };

    const pipeline = [
      {
        $addFields: {
          _joinId: {
            $let: {
              vars: { keys: { $objectToArray: { $ifNull: [linkPath, {}] } } },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$keys' }, 0] },
                  {
                    $toObjectId: {
                      $arrayElemAt: [{ $map: { input: '$$keys', as: 'item', in: '$$item.k' } }, 0],
                    },
                  },
                  null,
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from,
          localField: '_joinId',
          foreignField: '_id',
          as: '_joinRows',
        },
      },
      {
        $addFields: {
          _joinDoc: { $arrayElemAt: ['$_joinRows', 0] },
        },
      },
    ];

    if (parts.length > 0) {
      pipeline.push({
        $addFields: {
          [enrichAs]: {
            $trim: {
              input: {
                $concat: parts.flatMap((field, index) => {
                  const chunk = [{ $ifNull: [`$_joinDoc.${field}`, ''] }];
                  return index === 0 ? chunk : [' ', ...chunk];
                }),
              },
            },
          },
        },
      });
    }

    const or = [];
    for (const field of rootFields) {
      or.push({ [field]: regex });
    }
    for (const field of joinedFields) {
      or.push({ [`_joinDoc.${field}`]: regex });
    }
    if (parts.length > 0 && enrichAs) {
      or.push({ [enrichAs]: regex });
    }
    if (or.length > 0) {
      pipeline.push({ $match: { $or: or } });
    }

    pipeline.push({ $limit: cap });
    pipeline.push({
      $project: {
        _joinId: 0,
        _joinRows: 0,
        _joinDoc: 0,
      },
    });

    return { mode: 'aggregate', pipeline };
  },
});

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MarkingScheme, MarkingBullet, IllustrativeAnswer } from "@/lib/sqa-mock-exam/types";

interface MarkingSchemeDisplayProps {
  markingScheme: MarkingScheme;
  showIllustrative?: boolean;
}

/**
 * MarkingSchemeDisplay - Shows SQA-style marking scheme
 *
 * Displays:
 * - Generic scheme (process descriptions)
 * - Illustrative scheme (example answers)
 * - Notes and tolerances
 */
export function MarkingSchemeDisplay({
  markingScheme,
  showIllustrative = true,
}: MarkingSchemeDisplayProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Marking Scheme</CardTitle>
          <Badge variant="secondary">{markingScheme.max_marks} marks</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generic scheme */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 mb-2">
            Generic Scheme (What earns marks)
          </h4>
          <div className="space-y-2">
            {markingScheme.generic_scheme.map((bullet) => (
              <BulletDisplay key={bullet.bullet} bullet={bullet} />
            ))}
          </div>
        </div>

        {/* Illustrative scheme */}
        {showIllustrative && markingScheme.illustrative_scheme.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">
                Illustrative Answers (Examples)
              </h4>
              <div className="space-y-2">
                {markingScheme.illustrative_scheme.map((illustrative) => (
                  <IllustrativeDisplay
                    key={illustrative.bullet}
                    illustrative={illustrative}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        {markingScheme.notes && markingScheme.notes.length > 0 && (
          <>
            <Separator />
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm text-blue-800 mb-1">
                Marking Notes
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {markingScheme.notes.map((note, idx) => (
                  <li key={idx}>• {note}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * BulletDisplay - Shows a single marking bullet
 */
function BulletDisplay({ bullet }: { bullet: MarkingBullet }) {
  return (
    <div className="flex items-start gap-3 p-2 bg-gray-50 rounded">
      <Badge variant="outline" className="flex-shrink-0">
        •{bullet.bullet}
      </Badge>
      <div className="flex-1">
        <p className="text-sm">{bullet.process}</p>
      </div>
      <Badge variant="secondary" className="flex-shrink-0">
        {bullet.marks} mark{bullet.marks !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
}

/**
 * IllustrativeDisplay - Shows an illustrative answer
 */
function IllustrativeDisplay({ illustrative }: { illustrative: IllustrativeAnswer }) {
  return (
    <div className="p-3 bg-green-50 rounded border border-green-200">
      <div className="flex items-start gap-3">
        <Badge variant="outline" className="flex-shrink-0 bg-green-100">
          •{illustrative.bullet}
        </Badge>
        <div className="flex-1 space-y-1">
          {/* Main answer */}
          <div className="font-mono text-sm bg-white px-2 py-1 rounded">
            {illustrative.answer_latex || illustrative.answer}
          </div>

          {/* Tolerance range if specified */}
          {illustrative.tolerance_range && (
            <p className="text-xs text-green-700">
              Tolerance: {illustrative.tolerance_range}
            </p>
          )}

          {/* Acceptable variations */}
          {illustrative.acceptable_variations &&
            illustrative.acceptable_variations.length > 0 && (
              <div className="text-xs text-green-600">
                <span className="font-medium">Also accept: </span>
                {illustrative.acceptable_variations.join(", ")}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

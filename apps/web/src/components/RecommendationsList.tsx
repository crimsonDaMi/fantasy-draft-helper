import type {
  ApiRecommendation,
} from "../types/api";

interface RecommendationsListProps {
  recommendations:
    ApiRecommendation[];
}

export function RecommendationsList({
  recommendations,
}: RecommendationsListProps) {
  return (
    <section>
      <h2>
        Best Available Players
      </h2>

      {recommendations.length === 0 ? (
        <p>
          No recommendations available.
        </p>
      ) : (
        <ol>
          {recommendations.map(
            (recommendation) => (
              <li
                key={
                  recommendation.player
                    .sleeperId
                }
              >
                <strong>
                  #{recommendation.rank}
                </strong>

                {" "}

                {
                  recommendation.player
                    .fullName
                }

                {" — "}

                {
                  recommendation.player
                    .position
                }

                {" | "}

                {
                  recommendation.player
                    .team
                }

                {recommendation.tier && (
                  <>
                    {" | Tier: "}

                    {
                      recommendation.tier
                    }
                  </>
                )}
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
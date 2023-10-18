import { useState, useEffect } from "react";
import { Text, VStack, HStack, Tooltip, Box, Icon, GridItem } from "@chakra-ui/react";
import Link from "next/link";
import { BsQuestionCircle } from "react-icons/bs";

import ColoredPercent from "~/components/ColoredPercent";
import { useDataset, useModelTestingStats, useTestingEntries } from "~/utils/hooks";
import { displayBaseModel } from "~/utils/baseModels";

const ModelHeader = ({ modelId }: { modelId: string }) => {
  const [refetchInterval, setRefetchInterval] = useState(0);
  const dataset = useDataset().data;
  const stats = useModelTestingStats(dataset?.id, modelId, refetchInterval).data;
  const entries = useTestingEntries().data;

  useEffect(() => {
    if (!stats?.finishedCount || !entries?.count || stats?.finishedCount < entries?.count) {
      setRefetchInterval(5000);
    } else {
      setRefetchInterval(0);
    }
  }, [stats?.finishedCount, entries?.count]);

  if (!stats || !entries) return <GridItem />;

  return (
    <VStack alignItems="flex-start">
      {stats.isComparisonModel ? (
        <Text fontWeight="bold" color="gray.500">
          {stats.slug}
        </Text>
      ) : (
        <Text
          as={Link}
          href={{ pathname: "/fine-tunes/[id]", query: { id: modelId } }}
          _hover={{ textDecoration: "underline" }}
          fontWeight="bold"
          color="gray.500"
        >
          openpipe:{stats.slug}
        </Text>
      )}

      <HStack>
        {stats.averageScore !== null && (
          <>
            <ColoredPercent value={stats.averageScore} />
            <Tooltip
              label={
                <>
                  <Text>
                    % of fields from the ground truth that are exactly matched in the model's
                    output.
                  </Text>
                  <Text>We'll let you customize this calculation in the future.</Text>
                </>
              }
              aria-label="Help about accuracy"
            >
              <Box lineHeight={0}>
                <Icon as={BsQuestionCircle} color="gray.600" boxSize={4} />
              </Box>
            </Tooltip>
          </>
        )}
        {stats.baseModel && <Text color="gray.500">{displayBaseModel(stats.baseModel)}</Text>}

        {stats.finishedCount < entries.count && (
          <Text>
            {stats.finishedCount}/{entries.count}
          </Text>
        )}
      </HStack>
    </VStack>
  );
};

export default ModelHeader;
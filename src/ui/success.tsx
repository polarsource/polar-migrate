import { StatusMessage } from "@inkjs/ui";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import { Box, Text, render } from "ink";
import React from "react";

export const successMessage = async (
	organization: Organization,
	products: Product[],
	server: "sandbox" | "production",
) => {
	const { unmount, clear, waitUntilExit } = render(
		<Box flexDirection="column" columnGap={2}>
			<StatusMessage variant="success">
				<Text>Polar was successfully initialized!</Text>
			</StatusMessage>
			<Box flexDirection="column" paddingY={1}>
				<Text>
					Environment: <Text color="yellow">{server}</Text>
				</Text>
				<Text>
					Organization: <Text color="blue">{organization.name}</Text>
				</Text>
				<Text color="green">{products.length} Products Created:</Text>

				{products.map((product) => (
					<Text key={product.id}>- {product.name}</Text>
				))}
			</Box>
		</Box>,
	);

	setTimeout(() => {
		clear();
		unmount();
	}, 1500);

	await waitUntilExit();
};

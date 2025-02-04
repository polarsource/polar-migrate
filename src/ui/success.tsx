import { StatusMessage } from "@inkjs/ui";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Discount } from "@polar-sh/sdk/models/components/discount.js";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import { Box, Text, render } from "ink";
import React from "react";

export const successMessage = async (
	organization: Organization,
	products: Product[],
	createdDiscounts: Discount[],
	customers: Customer[],
	server: "sandbox" | "production",
) => {
	const { unmount, waitUntilExit } = render(
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
				{products.length > 0 && (
					<>
						<Text color="green">{products.length} Products Created:</Text>
						{products.map((product) => (
							<Text key={product.id}>- {product.name}</Text>
						))}
					</>
				)}
				{createdDiscounts.length > 0 && (
					<>
						<Text color="green">
							{createdDiscounts.length} Discounts Created:
						</Text>
						{createdDiscounts.map((discount) => (
							<Text key={discount.id}>
								- {discount.name} ({discount.code})
							</Text>
						))}
					</>
				)}
				{customers.length > 0 && (
					<Text color="green">{customers.length} Customers Imported</Text>
				)}
			</Box>
		</Box>,
	);

	setTimeout(() => {
		unmount();
	}, 1500);

	await waitUntilExit();
};

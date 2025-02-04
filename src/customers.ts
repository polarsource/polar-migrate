import {
	type Customer,
	listCustomers,
	type Store,
} from "@lemonsqueezy/lemonsqueezy.js";
import type { Polar } from "@polar-sh/sdk";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";

const importCustomer = async (
	polar: Polar,
	customer: Customer["data"],
	organization: Organization,
) => {
	try {
		return await polar.customers.create({
			organizationId: organization.id,
			email: customer.attributes.email,
			name: customer.attributes.name,
			billingAddress: {
				city: customer.attributes.city,
				state: customer.attributes.region,
				country: customer.attributes.country as string,
			},
		});
	} catch (error) {
		console.error("Failed to create customer:", error);
		return null;
	}
};

export const importCustomers = async (
	polar: Polar,
	store: Store["data"],
	organization: Organization,
) => {
	const customers = await listCustomers({
		filter: {
			storeId: store.id,
		},
	});

	return promiseAllInBatches(
		(customer) => importCustomer(polar, customer, organization),
		customers.data?.data ?? [],
		20,
	);
};

/**
 * Same as Promise.all(items.map(item => task(item))), but it waits for
 * the first {batchSize} promises to finish before starting the next batch.
 *
 * @template A
 * @template B
 * @param {function(A): B} task The task to run for each item.
 * @param {A[]} items Arguments to pass to the task for each call.
 * @param {int} batchSize
 * @returns {Promise<B[]>}
 */
async function promiseAllInBatches<A, B>(
	task: (item: A) => Promise<B>,
	items: A[],
	batchSize: number,
) {
	let position = 0;
	let results: B[] = [];
	while (position < items.length) {
		const itemsForBatch = items.slice(position, position + batchSize);
		results = [
			...results,
			...(await Promise.all(itemsForBatch.map((item) => task(item)))),
		];
		position += batchSize;
	}
	return results;
}

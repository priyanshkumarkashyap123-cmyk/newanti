use nalgebra::DVector;

use super::types::Node3D;

impl Node3D {
	pub fn coordinates(&self) -> (f64, f64, f64) {
		(self.x, self.y, self.z)
	}

	pub fn distance_to(&self, other: &Node3D) -> f64 {
		let dx = other.x - self.x;
		let dy = other.y - self.y;
		let dz = other.z - self.z;
		(dx * dx + dy * dy + dz * dz).sqrt()
	}

	pub fn dof_index(&self, local_dof: usize, node_index: usize) -> Option<usize> {
		if local_dof < 6 {
			Some(node_index * 6 + local_dof)
		} else {
			None
		}
	}

	pub fn dof_indices(&self, node_index: usize) -> [usize; 6] {
		[
			node_index * 6,
			node_index * 6 + 1,
			node_index * 6 + 2,
			node_index * 6 + 3,
			node_index * 6 + 4,
			node_index * 6 + 5,
		]
	}

	pub fn is_fully_restrained(&self) -> bool {
		self.restraints.iter().all(|&r| r)
	}

	pub fn restrained_dofs(&self) -> Vec<usize> {
		self.restraints
			.iter()
			.enumerate()
			.filter_map(|(i, &r)| if r { Some(i) } else { None })
			.collect()
	}

	pub fn free_dofs(&self) -> Vec<usize> {
		self.restraints
			.iter()
			.enumerate()
			.filter_map(|(i, &r)| if !r { Some(i) } else { None })
			.collect()
	}

	pub fn spring_vector(&self) -> Option<DVector<f64>> {
		self.spring_stiffness
			.as_ref()
			.map(|springs| DVector::from_vec(springs.clone()))
	}
}

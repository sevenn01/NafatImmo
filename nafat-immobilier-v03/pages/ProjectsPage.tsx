
import React, { useState, useEffect, useCallback } from 'react';
import { getProjects, getApartments, addProject, updateProject, deleteProject } from '../services/api';
import { PlusIcon } from '../components/icons/Icons';
import { Project, ProjectStatus, Apartment, ApartmentStatus } from '../types';
import Modal from '../components/Modal';
import ProjectCard from '../components/ProjectCard';
import { useAuth } from '../auth/AuthContext';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsData, apartmentsData] = await Promise.all([
          getProjects(),
          getApartments()
      ]);
      
      const projectsWithCounts = projectsData.map(p => ({
          ...p,
          rented_apartments_count: apartmentsData.filter(a => a.project_id === p.id && a.status === ApartmentStatus.Rented).length,
          sold_apartments_count: apartmentsData.filter(a => a.project_id === p.id && a.status === ApartmentStatus.Sold).length
      }));

      setProjects(projectsWithCounts);
      setApartments(apartmentsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    const projectData = {
        project_name: formData.get('projectName') as string,
        location: formData.get('location') as string,
        description: formData.get('description') as string,
        status: (formData.get('status') as ProjectStatus) || ProjectStatus.Active,
    };
    
    try {
      if (editingProject) {
        await updateProject(editingProject.id, projectData, user.user_id);
      } else {
        await addProject(projectData, user.user_id);
      }
      fetchData();
      setIsModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Erreur lors de la sauvegarde du projet.");
    }
  }

  const handleDeleteProject = async (projectId: string) => {
      if(window.confirm("Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible et supprimera toutes les propriétés, contrats et paiements associés.")) {
          try {
              await deleteProject(projectId);
              fetchData();
          } catch(error) {
              console.error("Failed to delete project:", error);
              alert("Erreur lors de la suppression du projet.");
          }
      }
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  }
  
  const openAddModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  }

  if (loading) {
    return <div>Chargement des projets...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Projets</h2>
        <button 
          onClick={openAddModal}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center"
        >
            <PlusIcon className="w-5 h-5 mr-2" />
            Ajouter un Projet
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} onEdit={() => openEditModal(project)} onDelete={() => handleDeleteProject(project.id)} />
        ))}
      </div>

      <Modal title={editingProject ? "Modifier le Projet" : "Ajouter un Nouveau Projet"} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingProject(null); }}>
        <form onSubmit={handleFormSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Nom du Projet</label>
              <input type="text" name="projectName" id="projectName" defaultValue={editingProject?.project_name} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">Localisation</label>
              <input type="text" name="location" id="location" defaultValue={editingProject?.location} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" />
            </div>
            {editingProject && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Statut</label>
                <select name="status" id="status" defaultValue={editingProject?.status} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                  <option value={ProjectStatus.Active}>Actif</option>
                  <option value={ProjectStatus.Paused}>En Pause</option>
                  <option value={ProjectStatus.Completed}>Terminé</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" id="description" rows={3} defaultValue={editingProject?.description} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"></textarea>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingProject(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Sauvegarder</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default ProjectsPage;


import React, { useState, useEffect, useCallback } from 'react';
import { getProjects, getApartments, addProject, updateProject, deleteProject } from '../services/api';
import { PlusIcon } from '../components/icons/Icons';
import { Project, ProjectStatus, Apartment, ApartmentStatus } from '../types';
import Modal from '../components/Modal';
import ProjectCard from '../components/ProjectCard';
import { useAuth } from '../auth/AuthContext';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
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
          sold_apartments_count: apartmentsData.filter(a => a.project_id === p.id && a.status === ApartmentStatus.Sold).length,
          registered_count: apartmentsData.filter(a => a.project_id === p.id).length
      }));

      setProjects(projectsWithCounts);
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
    const projectData: Partial<Project> = {
        project_name: formData.get('projectName') as string,
        location: formData.get('location') as string,
        description: formData.get('description') as string,
        status: (formData.get('status') as ProjectStatus) || ProjectStatus.Active,
        num_floors: Number(formData.get('num_floors')),
        has_rdc: formData.get('has_rdc') === 'on',
        total_apartments: Number(formData.get('total_apartments'))
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

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 text-gray-900 sm:text-sm";

  if (loading) {
    return <div className="p-8">Chargement des projets...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Projets</h2>
        <button 
          onClick={openAddModal}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition duration-200 flex items-center shadow-sm"
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
              <input type="text" name="projectName" id="projectName" defaultValue={editingProject?.project_name} required className={inputClasses} />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">Localisation</label>
              <input type="text" name="location" id="location" defaultValue={editingProject?.location} required className={inputClasses} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="num_floors" className="block text-sm font-medium text-gray-700">Nombre d'étages</label>
                  <input type="number" min="0" name="num_floors" id="num_floors" defaultValue={editingProject?.num_floors || 0} required className={inputClasses} />
                </div>
                <div>
                  <label htmlFor="total_apartments" className="block text-sm font-medium text-gray-700">Capacité (Unités)</label>
                  <input type="number" min="1" name="total_apartments" id="total_apartments" defaultValue={editingProject?.total_apartments || 1} required className={inputClasses} />
                </div>
                <div className="flex items-end pb-2">
                    <div className="flex items-center">
                        <input id="has_rdc" name="has_rdc" type="checkbox" defaultChecked={editingProject?.has_rdc !== false} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                        <label htmlFor="has_rdc" className="ml-2 block text-sm text-gray-900 font-medium">Inclure RDC</label>
                    </div>
                </div>
            </div>

            {editingProject && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Statut</label>
                <select name="status" id="status" defaultValue={editingProject?.status} className={inputClasses}>
                  <option value={ProjectStatus.Active}>Actif</option>
                  <option value={ProjectStatus.Paused}>En Pause</option>
                  <option value={ProjectStatus.Completed}>Terminé</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea name="description" id="description" rows={3} defaultValue={editingProject?.description} className={inputClasses}></textarea>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingProject(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm">Sauvegarder</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default ProjectsPage;

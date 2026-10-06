// Hand-written messages for small components: error boundary, copy button, map picker, notes, bans, timeline, diagram.
export const en = {
  'errorBoundary.title': 'Something broke',
  'errorBoundary.body': 'The planner hit an unexpected error. Reloading usually fixes it.',
  'errorBoundary.reload': 'Reload',

  'copy.copied': 'Copied!',
  'copy.failed': 'Copy failed',
  'copy.lineup': 'Copy lineup',

  'mapPicker.map': 'Map',
  'mapPicker.sites': '{count, plural, one {# site} other {# sites}}',
  'mapPicker.noSites': 'No bomb sites are defined for {map} yet. Add them to <code>src/data/maps.json</code>.',
  'mapPicker.bombSitesOf': 'Bomb sites on {map}',

  'notes.heading': '{map} notes',
  'notes.owner.mine': 'My notes ({player})',
  'notes.owner.other': '{player}’s notes',
  'notes.label.team': 'Team notes for {map}',
  'notes.label.mine': 'My notes for {map}',
  'notes.label.other': '{player}’s notes for {map}',
  'notes.edit.team': 'Edit team notes',
  'notes.edit.mine': 'Edit my notes',
  'notes.edit.other': 'Edit {player}’s notes',
  'notes.add': 'Add notes for {map}',
  'notes.none': '{player} hasn’t written notes for {map}.',
  'notes.saveFailed': 'Could not save notes.',

  'bans.title': 'Bans',
  'bans.ban': 'Ban {operator}',
  'bans.unban': 'Unban {operator}',

  'timeline.step': 'Step {n}: {title}',
  'lineupCard.reroll': 'Re-roll {player}',

  'mapLayer.missingTitle': 'No floor plan for {map} · {floor}',
  'mapLayer.addFile': 'Add {file} · see Maps → Floor plans',

  'diagram.mapImageAlt': 'Map image for {name}',
  'diagram.floorPlanAlt': '{where} floor plan',
  'tacticDiagram.noPlan': 'No floor plan for {where} yet.',
  'tacticDiagram.spot': 'Spot {n}',
};

export const fr = {
  'errorBoundary.title': 'Quelque chose a planté',
  'errorBoundary.body': 'Le planificateur a rencontré une erreur inattendue. Recharger la page règle souvent le problème.',
  'errorBoundary.reload': 'Recharger',

  'copy.copied': 'Copié !',
  'copy.failed': 'Échec de la copie',
  'copy.lineup': 'Copier la formation',

  'mapPicker.map': 'Carte',
  'mapPicker.sites': '{count, plural, one {# site} other {# sites}}',
  'mapPicker.noSites': 'Aucun site de bombe n’est défini pour {map} pour l’instant. Ajoute-les dans <code>src/data/maps.json</code>.',
  'mapPicker.bombSitesOf': 'Sites de bombe sur {map}',

  'notes.heading': 'Notes sur {map}',
  'notes.owner.mine': 'Mes notes ({player})',
  'notes.owner.other': 'Notes ({player})',
  'notes.label.team': 'Notes d’équipe pour {map}',
  'notes.label.mine': 'Mes notes pour {map}',
  'notes.label.other': 'Notes ({player}) pour {map}',
  'notes.edit.team': 'Modifier les notes d’équipe',
  'notes.edit.mine': 'Modifier mes notes',
  'notes.edit.other': 'Modifier les notes ({player})',
  'notes.add': 'Ajouter des notes pour {map}',
  'notes.none': '{player} n’a pas écrit de notes pour {map}.',
  'notes.saveFailed': 'Impossible d’enregistrer les notes.',

  'bans.title': 'Bannissements',
  'bans.ban': 'Bannir {operator}',
  'bans.unban': 'Débannir {operator}',

  'timeline.step': 'Étape {n} : {title}',
  'lineupCard.reroll': 'Relancer pour {player}',

  'mapLayer.missingTitle': 'Aucun plan d’étage pour {map} · {floor}',
  'mapLayer.addFile': 'Ajoute {file} · voir Cartes → Plans d’étage',

  'diagram.mapImageAlt': 'Image de la carte pour {name}',
  'diagram.floorPlanAlt': 'Plan d’étage : {where}',
  'tacticDiagram.noPlan': 'Aucun plan d’étage pour {where} pour l’instant.',
  'tacticDiagram.spot': 'Place {n}',
};
